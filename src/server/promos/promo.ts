import "server-only";

import { Prisma } from "@prisma/client";

import { discountMinor, majorToMinor } from "~/lib/promo-code";
import { paymentStatus } from "~/lib/order-status";
import { db, isUniqueConstraintError } from "~/server/db";
import {
  DRAFT_TTL_MS,
  failPendingInvoice,
  findOrCreatePendingOrder,
  type PendingOrderDraft,
} from "~/server/orders/draft";

export const promoErrorCodes = [
  "promo_not_found",
  "promo_inactive",
  "promo_used",
  "promo_held",
  "promo_exhausted",
  "promo_too_small",
] as const;

export type PromoErrorCode = (typeof promoErrorCodes)[number];

export class PromoError extends Error {
  readonly code: PromoErrorCode;

  constructor(code: PromoErrorCode) {
    super(code);
    this.name = "PromoError";
    this.code = code;
  }
}

export function promoErrorResponse(error: PromoError) {
  return Response.json({ error: error.code }, { status: 409 });
}

type PromoRow = {
  id: bigint;
  discountPercent: number;
  maxPerUser: number | null;
  maxRedemptions: number | null;
  startsAt: Date;
  endsAt: Date | null;
  revokedAt: Date | null;
};

function promoInactive(promo: PromoRow, now: Date) {
  if (promo.revokedAt) return true;
  if (promo.startsAt > now) return true;
  if (promo.endsAt && promo.endsAt <= now) return true;
  return false;
}

function minorToMajor(amount: bigint) {
  return Number(amount) / 100;
}

export async function quotePromo(input: {
  code: string;
  userId: string;
  priceRub: number;
  priceUsd: number;
}) {
  const promo = await db.promoCode.findUnique({ where: { code: input.code } });
  if (!promo) throw new PromoError("promo_not_found");
  if (promoInactive(promo, new Date())) throw new PromoError("promo_inactive");

  const listRub = majorToMinor(input.priceRub);
  const listUsd = majorToMinor(input.priceUsd);
  const chargedRub = listRub
    ? discountMinor(listRub, promo.discountPercent)
    : null;
  const chargedUsd = listUsd
    ? discountMinor(listUsd, promo.discountPercent)
    : null;
  if (chargedRub == null || chargedUsd == null) {
    throw new PromoError("promo_too_small");
  }

  if (promo.maxPerUser === 1) {
    const live = await db.promoRedemption.findFirst({
      where: {
        promoCodeId: promo.id,
        userId: input.userId,
        releasedAt: null,
      },
    });
    if (live?.consumedAt) throw new PromoError("promo_used");
  }

  if (promo.maxRedemptions != null) {
    const used = await db.promoRedemption.count({
      where: { promoCodeId: promo.id, releasedAt: null },
    });
    const ownOpen =
      promo.maxPerUser === 1
        ? await db.promoRedemption.findFirst({
            where: {
              promoCodeId: promo.id,
              userId: input.userId,
              releasedAt: null,
              consumedAt: null,
            },
          })
        : null;
    if (used >= promo.maxRedemptions && !ownOpen) {
      throw new PromoError("promo_exhausted");
    }
  }

  return {
    discountPercent: promo.discountPercent,
    priceRub: minorToMajor(chargedRub),
    priceUsd: minorToMajor(chargedUsd),
  };
}

function orderHasInvoice(order: {
  paymentInvoiceUrl: string | null;
  paymentInvoiceId: string | null;
  paymentInvoiceClaim: string | null;
}) {
  return (
    order.paymentInvoiceUrl != null ||
    order.paymentInvoiceId != null ||
    order.paymentInvoiceClaim != null
  );
}

/**
 * Lock the code, create or reuse the discounted draft, and reserve one redemption.
 * `draft.priceAmount` is the list price. The stored order price is the charge.
 */
export async function placeCheckoutOrder(
  draft: PendingOrderDraft,
  promoCode?: string,
) {
  if (!promoCode) {
    return findOrCreatePendingOrder(draft);
  }
  const code = promoCode;
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: bigint }>>(
      Prisma.sql`SELECT "id" FROM "promo_codes" WHERE "code" = ${code} FOR UPDATE`,
    );
    const promoId = locked[0]?.id;
    if (promoId == null) throw new PromoError("promo_not_found");
    const promo = await tx.promoCode.findUnique({ where: { id: promoId } });
    if (!promo) throw new PromoError("promo_not_found");
    if (promoInactive(promo, new Date()))
      throw new PromoError("promo_inactive");

    const charged = discountMinor(draft.priceAmount, promo.discountPercent);
    if (charged == null) throw new PromoError("promo_too_small");

    const oncePerUser = promo.maxPerUser === 1;
    if (oncePerUser) {
      const live = await tx.promoRedemption.findFirst({
        where: {
          promoCodeId: promo.id,
          userId: draft.userId,
          releasedAt: null,
        },
      });
      if (live) {
        if (live.consumedAt) throw new PromoError("promo_used");
        const existing = await tx.order.findUnique({
          where: { id: live.orderId },
        });
        if (!existing) throw new PromoError("promo_used");
        const sameDraft =
          existing.paymentProvider === draft.paymentProvider &&
          existing.resellerPlanId === draft.resellerPlanId &&
          existing.priceAmount === charged &&
          existing.currency === draft.currency &&
          existing.promoCodeId === promo.id &&
          existing.paymentStatus === paymentStatus.pending &&
          existing.status === "created" &&
          existing.cartRevision === (draft.cartRevision ?? null) &&
          Date.now() - existing.createdAt.getTime() <= DRAFT_TTL_MS;
        if (orderHasInvoice(existing) && !sameDraft) {
          throw new PromoError("promo_held");
        }
        if (!orderHasInvoice(existing) && !sameDraft) {
          await failPendingInvoice(existing.id, "superseded", tx);
        }
      }
    }

    const order = await findOrCreatePendingOrder(
      {
        ...draft,
        priceAmount: charged,
        promoCodeId: promo.id,
      },
      tx,
    );

    const reserved = await tx.promoRedemption.findFirst({
      where: { orderId: order.id, releasedAt: null },
    });
    if (!reserved) {
      const openCount = await tx.promoRedemption.count({
        where: { promoCodeId: promo.id, releasedAt: null },
      });
      if (promo.maxRedemptions != null && openCount >= promo.maxRedemptions) {
        throw new PromoError("promo_exhausted");
      }
      try {
        await tx.promoRedemption.create({
          data: {
            promoCodeId: promo.id,
            userId: draft.userId,
            orderId: order.id,
            oncePerUser,
            discountPercent: promo.discountPercent,
            listPriceAmount: draft.priceAmount,
            chargedAmount: charged,
            currency: draft.currency,
          },
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        throw new PromoError("promo_used");
      }
    }
    return order;
  });
}

/** Idempotent. A paid order keeps the code even if fulfillment is retried. */
export async function consumePromoRedemption(orderId: bigint) {
  await db.promoRedemption.updateMany({
    where: { orderId, consumedAt: null, releasedAt: null },
    data: { consumedAt: new Date() },
  });
}
