import "server-only";

import type { Prisma } from "@prisma/client";

import { orderStatus, paymentStatus } from "~/lib/order-status";
import { db, isUniqueConstraintError } from "~/server/db";
import { assertSupplierCapacity } from "~/server/orders/supplier-capacity";

type DraftDb = Prisma.TransactionClient | typeof db;

/**
 * A pending draft (and its provider invoice) is reused for this long. After
 * that the draft is closed as `expired` and checkout mints a fresh one, so a
 * user never gets handed a provider link that has already expired.
 */
export const DRAFT_TTL_MS = 15 * 60_000;

export type PendingOrderDraft = {
  userId: string;
  resellerPlanId: string;
  packageName: string;
  countryCode: string | null;
  dataAmountMb: number;
  validityDays: number;
  priceAmount: bigint;
  currency: string;
  costAmount: bigint;
  costCurrency: string;
  paymentProvider: string;
  buyerIp?: string | null;
  cartRevision?: string | null;
  topupOfOrderId?: bigint | null;
  topupPeriodDays?: number | null;
  promoCodeId?: bigint | null;
};

function pendingDraftWhere(data: PendingOrderDraft) {
  return {
    userId: data.userId,
    paymentProvider: data.paymentProvider,
    paymentStatus: paymentStatus.pending,
    status: orderStatus.created,
    resellerPlanId: data.resellerPlanId,
    priceAmount: data.priceAmount,
    currency: data.currency,
    topupOfOrderId: data.topupOfOrderId ?? null,
    topupPeriodDays: data.topupPeriodDays ?? null,
    promoCodeId: data.promoCodeId ?? null,
  };
}

export async function findOrCreatePendingOrder(
  data: PendingOrderDraft,
  client: DraftDb = db,
) {
  const where = pendingDraftWhere(data);
  const existing = await client.order.findFirst({
    where,
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    if (
      existing.cartRevision === (data.cartRevision ?? null) &&
      Date.now() - existing.createdAt.getTime() <= DRAFT_TTL_MS
    ) {
      return existing;
    }
    await failPendingInvoice(existing.id, "expired", client);
  }

  try {
    return await client.order.create({
      data: {
        userId: data.userId,
        resellerCode: "esimaccess",
        resellerPlanId: data.resellerPlanId,
        packageName: data.packageName,
        countryCode: data.countryCode,
        dataAmountMb: data.dataAmountMb,
        validityDays: data.validityDays,
        priceAmount: data.priceAmount,
        currency: data.currency,
        costAmount: data.costAmount,
        costCurrency: data.costCurrency,
        paymentProvider: data.paymentProvider,
        buyerIp: data.buyerIp ?? null,
        cartRevision: data.cartRevision ?? null,
        topupOfOrderId: data.topupOfOrderId ?? null,
        topupPeriodDays: data.topupPeriodDays ?? null,
        promoCodeId: data.promoCodeId ?? null,
        paymentStatus: paymentStatus.pending,
        status: orderStatus.created,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
    const raced = await client.order.findFirst({
      where,
      orderBy: { createdAt: "desc" },
    });
    if (
      raced?.cartRevision !== (data.cartRevision ?? null) ||
      raced?.topupOfOrderId !== (data.topupOfOrderId ?? null) ||
      raced?.topupPeriodDays !== (data.topupPeriodDays ?? null) ||
      raced?.promoCodeId !== (data.promoCodeId ?? null)
    ) {
      throw error;
    }
    return raced;
  }
}

/** Only one request may call the provider for a draft. An abandoned claim is
 * retired with the draft TTL, never stolen while its outcome is unknown. */
export async function createPendingInvoice(
  orderId: bigint,
  create: () => Promise<{ url: string; id?: string }>,
): Promise<string | null> {
  const claim = crypto.randomUUID();
  const claimed = await db.$transaction(
    async (tx) => {
      // One shared account across providers and app instances. Commit the claim
      // (our durable reservation) before making any payment-provider request.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(73501942)`;
      const claimed = await tx.order.updateMany({
        where: {
          id: orderId,
          status: orderStatus.created,
          paymentStatus: paymentStatus.pending,
          paymentInvoiceUrl: null,
          paymentInvoiceClaim: null,
        },
        data: { paymentInvoiceClaim: claim },
      });
      if (claimed.count) await assertSupplierCapacity(tx, orderId);
      return claimed;
    },
    { timeout: 40_000, maxWait: 5_000 },
  );
  if (!claimed.count) {
    const current = await db.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    if (
      current.paymentStatus !== paymentStatus.pending ||
      current.status !== orderStatus.created
    ) {
      throw new Error("invoice_closed");
    }
    return current.paymentInvoiceUrl;
  }
  try {
    const { url, id } = await create();
    // Keep the provider ID even if a callback or draft expiry won the race.
    // Such invoices can still be paid and must remain reconcilable.
    if (id) {
      await db.order.updateMany({
        where: { id: orderId, paymentInvoiceClaim: claim },
        data: { paymentInvoiceId: id },
      });
    }
    const attached = await db.order.updateMany({
      where: {
        id: orderId,
        paymentInvoiceClaim: claim,
        paymentStatus: paymentStatus.pending,
        status: orderStatus.created,
      },
      data: { paymentInvoiceUrl: url },
    });
    if (!attached.count) throw new Error("invoice_closed");
    return url;
  } catch (error) {
    await db.order.updateMany({
      where: {
        id: orderId,
        paymentInvoiceClaim: claim,
        paymentInvoiceUrl: null,
        paymentStatus: paymentStatus.pending,
        status: orderStatus.created,
      },
      data: {
        status: orderStatus.failed,
        paymentStatus: paymentStatus.failed,
        failureReason: "invoice_failed",
      },
    });
    throw error;
  }
}

export async function failPendingInvoice(
  orderId: bigint,
  reason: string,
  client: DraftDb = db,
) {
  const current = await client.order.findUnique({ where: { id: orderId } });
  await client.order.updateMany({
    where: {
      id: orderId,
      paymentStatus: paymentStatus.pending,
      status: orderStatus.created,
    },
    data: {
      status: orderStatus.failed,
      paymentStatus: paymentStatus.failed,
      failureReason: reason,
    },
  });
  // A provider invoice can still be paid after the draft is closed. Release
  // the promo only when this order never reached a provider.
  if (
    current &&
    current.paymentInvoiceUrl == null &&
    current.paymentInvoiceId == null &&
    current.paymentInvoiceClaim == null
  ) {
    await client.promoRedemption.updateMany({
      where: { orderId, releasedAt: null, consumedAt: null },
      data: { releasedAt: new Date() },
    });
  }
}
