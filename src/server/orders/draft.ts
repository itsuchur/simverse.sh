import "server-only";

import { orderStatus, paymentStatus } from "~/lib/order-status";
import { db, isUniqueConstraintError } from "~/server/db";

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
    return existing;
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
