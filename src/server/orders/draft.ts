import "server-only";

import { orderStatus, paymentStatus } from "~/lib/order-status";
import { db, isUniqueConstraintError } from "~/server/db";

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
  };
}

export async function findOrCreatePendingOrder(data: PendingOrderDraft) {
  const where = pendingDraftWhere(data);
  const existing = await db.order.findFirst({
    where,
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    if (Date.now() - existing.createdAt.getTime() <= DRAFT_TTL_MS) {
      return existing;
    }
    await failPendingInvoice(existing.id, "expired");
  }

  try {
    return await db.order.create({
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
        paymentStatus: paymentStatus.pending,
        status: orderStatus.created,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
    const raced = await db.order.findFirst({
      where,
      orderBy: { createdAt: "desc" },
    });
    if (!raced) {
      throw error;
    }
    return raced;
  }
}

/**
 * Stores the provider checkout link on the draft. Concurrent checkouts may
 * each mint an invoice; only the first is kept and handed out, so the user is
 * never shown two payable links for the same order.
 */
export async function attachInvoiceUrl(orderId: bigint, url: string) {
  const stored = await db.order.updateMany({
    where: { id: orderId, paymentInvoiceUrl: null },
    data: { paymentInvoiceUrl: url },
  });
  if (stored.count > 0) {
    return url;
  }
  const current = await db.order.findUniqueOrThrow({
    where: { id: orderId },
  });
  return current.paymentInvoiceUrl ?? url;
}

export async function failPendingInvoice(orderId: bigint, reason: string) {
  await db.order.updateMany({
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
}
