import "server-only";

import * as Sentry from "@sentry/nextjs";

import { clearCart } from "~/server/cart";
import { db, isUniqueConstraintError } from "~/server/db";
import {
  orderEsimAccessPackage,
  queryEsimAccessProfiles,
  type EsimAccessProfile,
} from "~/server/suppliers/esimaccess/order";
import {
  CARDLINK_PAYMENT_PROVIDER,
  TRYBIT_PAYMENT_PROVIDER,
  orderStatus,
  paymentStatus,
  STARS_PAYMENT_PROVIDER,
} from "~/lib/order-status";
import { isEsimLifecycleStatus } from "~/lib/esim-status";
import { captureServerEvent } from "~/lib/posthog/server";

export {
  CARDLINK_PAYMENT_PROVIDER,
  TRYBIT_PAYMENT_PROVIDER,
  orderStatus,
  paymentStatus,
  STARS_PAYMENT_PROVIDER,
};

const STALE_SUPPLIER_CLAIM_MS = 60_000;

type OrderRow = {
  id: bigint;
  orderUuid: string;
  userId: string;
  resellerPlanId: string;
  resellerOrderId: string | null;
  status: string;
  esimIccid: string | null;
};

async function applyProfile(
  orderId: bigint,
  profile: EsimAccessProfile,
  extra?: { resellerOrderId?: string },
) {
  const result = await db.order.updateMany({
    where: {
      id: orderId,
      status: { in: [orderStatus.paid, orderStatus.ordering] },
    },
    data: {
      status: orderStatus.issued,
      issuedAt: new Date(),
      esimIccid: profile.iccid,
      esimStatus:
        profile.esimStatus && isEsimLifecycleStatus(profile.esimStatus)
          ? profile.esimStatus
          : undefined,
      esimSmdpStatus: profile.smdpStatus,
      esimActivationCode: profile.ac,
      esimQrUrl: profile.qrCodeUrl,
      esimSmdpAddress: profile.smdpAddress,
      ...(extra?.resellerOrderId
        ? { resellerOrderId: extra.resellerOrderId }
        : {}),
    },
  });
  if (result.count === 0) {
    return;
  }

  const updated = await db.order.findUnique({
    where: { id: orderId },
    include: { user: { select: { telegramId: true } } },
  });
  if (!updated) {
    return;
  }

  captureServerEvent({
    event: "esim_issued",
    distinctId: updated.user.telegramId,
    orderUuid: updated.orderUuid,
    properties: { packageCode: updated.resellerPlanId },
  });
}

function captureOrderPaid(input: {
  distinctId: string | null | undefined;
  orderUuid: string;
  paymentProvider: string;
  priceAmount: bigint;
  currency: string;
}) {
  captureServerEvent({
    event: "order_paid",
    distinctId: input.distinctId,
    orderUuid: input.orderUuid,
    properties: {
      paymentProvider: input.paymentProvider,
      priceAmount: input.priceAmount.toString(),
      currency: input.currency,
    },
  });
}

function alertSecondCharge(input: {
  provider: string;
  orderUuid: string;
  existingChargeId: string | null;
  incomingChargeId: string;
}) {
  Sentry.captureMessage("Duplicate payment charge for already-paid order", {
    level: "error",
    tags: { component: input.provider, reason: "second_charge" },
    extra: {
      orderUuid: input.orderUuid,
      existingChargeId: input.existingChargeId,
      incomingChargeId: input.incomingChargeId,
    },
  });
}

export async function syncEsimProfile(order: OrderRow) {
  if (order.status === orderStatus.issued && order.esimIccid) {
    return;
  }
  if (!order.resellerOrderId) {
    return;
  }

  const profiles = await queryEsimAccessProfiles(order.resellerOrderId);
  const profile = profiles[0];
  if (!profile) {
    return;
  }

  await applyProfile(order.id, profile);
}

async function claimSupplierOrder(orderId: bigint): Promise<boolean> {
  const claimed = await db.order.updateMany({
    where: {
      id: orderId,
      resellerOrderId: null,
      status: orderStatus.paid,
      paymentStatus: paymentStatus.paid,
    },
    data: {
      status: orderStatus.ordering,
    },
  });
  if (claimed.count > 0) {
    return true;
  }

  const staleBefore = new Date(Date.now() - STALE_SUPPLIER_CLAIM_MS);
  const reclaimed = await db.order.updateMany({
    where: {
      id: orderId,
      resellerOrderId: null,
      status: orderStatus.ordering,
      paymentStatus: paymentStatus.paid,
      updatedAt: { lt: staleBefore },
    },
    data: {
      status: orderStatus.ordering,
      updatedAt: new Date(),
    },
  });
  return reclaimed.count > 0;
}

export async function placeSupplierOrder(order: OrderRow) {
  if (order.resellerOrderId) {
    await syncEsimProfile(order);
    return;
  }

  const claimed = await claimSupplierOrder(order.id);
  if (!claimed) {
    const current = await db.order.findUnique({ where: { id: order.id } });
    if (current?.resellerOrderId) {
      await syncEsimProfile(current);
    }
    return;
  }

  try {
    const result = await orderEsimAccessPackage({
      transactionId: order.orderUuid,
      packageCode: order.resellerPlanId,
    });

    const updated = await db.order.update({
      where: { id: order.id },
      data: {
        resellerOrderId: result.orderNo,
        status: orderStatus.ordering,
        resellerRawResponse: result,
      },
    });

    try {
      await syncEsimProfile({
        ...order,
        resellerOrderId: updated.resellerOrderId,
        status: updated.status,
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: "esimaccess", reason: "query_failed" },
        extra: { orderUuid: order.orderUuid },
      });
    }
  } catch (error) {
    Sentry.captureException(error, {
      level: "fatal",
      tags: { component: "esimaccess", reason: "order_failed" },
      extra: { orderUuid: order.orderUuid, packageCode: order.resellerPlanId },
    });
    const user = await db.user.findUnique({
      where: { id: order.userId },
      select: { telegramId: true },
    });
    captureServerEvent({
      event: "esim_issue_failed",
      distinctId: user?.telegramId,
      orderUuid: order.orderUuid,
      properties: { packageCode: order.resellerPlanId },
    });
    await db.order.updateMany({
      where: {
        id: order.id,
        esimIccid: null,
        status: { in: [orderStatus.ordering, orderStatus.paid] },
      },
      data: {
        status: orderStatus.failed,
        failureReason: error instanceof Error ? error.message : "order_failed",
      },
    });
  }
}

async function supersedePendingDrafts(
  order: {
    id: bigint;
    userId: string;
    resellerPlanId: string;
  },
  provider: string,
) {
  await db.order.updateMany({
    where: {
      userId: order.userId,
      id: { not: order.id },
      paymentProvider: provider,
      paymentStatus: paymentStatus.pending,
      status: orderStatus.created,
      resellerPlanId: order.resellerPlanId,
    },
    data: {
      status: orderStatus.failed,
      paymentStatus: paymentStatus.failed,
      failureReason: "superseded",
    },
  });
}

async function findOrderByCharge(provider: string, chargeId: string) {
  return db.order.findFirst({
    where: {
      paymentProvider: provider,
      paymentChargeId: chargeId,
    },
    include: { user: { select: { telegramId: true } } },
  });
}

async function markOrderPaid(input: {
  orderId: bigint;
  provider: string;
  chargeId: string;
}) {
  const result = await db.order.updateMany({
    where: {
      id: input.orderId,
      paymentProvider: input.provider,
      paymentStatus: paymentStatus.pending,
      status: orderStatus.created,
    },
    data: {
      paymentStatus: paymentStatus.paid,
      paymentChargeId: input.chargeId,
      paidAt: new Date(),
      status: orderStatus.paid,
    },
  });
  if (result.count === 0) {
    return null;
  }
  return db.order.findUniqueOrThrow({
    where: { id: input.orderId },
    include: { user: { select: { telegramId: true } } },
  });
}

async function continueFulfillment(order: OrderRow, provider: string) {
  await supersedePendingDrafts(order, provider);
  await placeSupplierOrder(order);
}

async function fulfillPayment(input: {
  provider: string;
  orderUuid: string;
  chargeId: string;
  telegramId?: string | null;
  validate?: (order: {
    priceAmount: bigint;
    currency: string;
  }) => boolean;
}) {
  const alreadyCharged = await findOrderByCharge(input.provider, input.chargeId);
  if (alreadyCharged) {
    await continueFulfillment(alreadyCharged, input.provider);
    return;
  }

  const order = await db.order.findUnique({
    where: { orderUuid: input.orderUuid },
    include: { user: { select: { telegramId: true } } },
  });
  if (!order) {
    return;
  }
  if (order.paymentProvider !== input.provider) {
    return;
  }

  const telegramId = input.telegramId ?? order.user.telegramId;

  if (order.paymentStatus === paymentStatus.paid) {
    if (order.paymentChargeId === input.chargeId) {
      await continueFulfillment(order, input.provider);
      return;
    }
    alertSecondCharge({
      provider: input.provider,
      orderUuid: order.orderUuid,
      existingChargeId: order.paymentChargeId,
      incomingChargeId: input.chargeId,
    });
    return;
  }

  if (
    order.paymentStatus !== paymentStatus.pending ||
    order.status !== orderStatus.created
  ) {
    return;
  }

  if (input.validate && !input.validate(order)) {
    return;
  }

  try {
    const paid = await markOrderPaid({
      orderId: order.id,
      provider: input.provider,
      chargeId: input.chargeId,
    });
    if (!paid) {
      const charged = await findOrderByCharge(input.provider, input.chargeId);
      if (charged) {
        await continueFulfillment(charged, input.provider);
        return;
      }
      const current = await db.order.findUnique({
        where: { id: order.id },
      });
      if (
        current?.paymentStatus === paymentStatus.paid &&
        current.paymentChargeId !== input.chargeId
      ) {
        alertSecondCharge({
          provider: input.provider,
          orderUuid: current.orderUuid,
          existingChargeId: current.paymentChargeId,
          incomingChargeId: input.chargeId,
        });
      }
      return;
    }

    captureOrderPaid({
      distinctId: telegramId,
      orderUuid: paid.orderUuid,
      paymentProvider: input.provider,
      priceAmount: order.priceAmount,
      currency: order.currency,
    });
    if (typeof telegramId === "string" && telegramId.length > 0) {
      await clearCart(telegramId);
    }
    await continueFulfillment(paid, input.provider);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const charged = await findOrderByCharge(input.provider, input.chargeId);
      if (charged) {
        await continueFulfillment(charged, input.provider);
      }
      return;
    }
    throw error;
  }
}

export async function fulfillStarsPayment(input: {
  orderUuid: string;
  telegramPaymentChargeId: string;
  telegramId: string;
}) {
  await fulfillPayment({
    provider: STARS_PAYMENT_PROVIDER,
    orderUuid: input.orderUuid,
    chargeId: input.telegramPaymentChargeId,
    telegramId: input.telegramId,
  });
}

function usdAmountToCents(amount: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return null;
  }
  return BigInt(Math.round(value * 100));
}

async function failPendingPayment(orderUuid: string, provider: string) {
  await db.order.updateMany({
    where: {
      orderUuid,
      paymentProvider: provider,
      paymentStatus: paymentStatus.pending,
      status: orderStatus.created,
    },
    data: {
      status: orderStatus.failed,
      paymentStatus: paymentStatus.failed,
      failureReason: "payment_failed",
    },
  });
}

function usdNumberToCents(amount: number) {
  if (!Number.isFinite(amount)) {
    return null;
  }
  return BigInt(Math.round(amount * 100));
}

export async function fulfillTrybitPayment(input: {
  orderUuid: string;
  invoiceUuid: string;
  amountUsd: number;
}) {
  await fulfillPayment({
    provider: TRYBIT_PAYMENT_PROVIDER,
    orderUuid: input.orderUuid,
    chargeId: input.invoiceUuid,
    validate: (order) => {
      const cents = usdNumberToCents(input.amountUsd);
      if (cents === null || cents !== order.priceAmount) {
        Sentry.captureMessage("Trybit webhook amount mismatch", {
          level: "error",
          tags: { component: "trybit", reason: "amount_mismatch" },
          extra: {
            orderUuid: input.orderUuid,
            expected: order.priceAmount.toString(),
            received: input.amountUsd,
          },
        });
        return false;
      }
      return true;
    },
  });
}

export async function failTrybitPayment(orderUuid: string) {
  await failPendingPayment(orderUuid, TRYBIT_PAYMENT_PROVIDER);
}

export async function fulfillCardlinkPayment(input: {
  orderUuid: string;
  billId: string;
  amount: string;
  currency: string;
}) {
  await fulfillPayment({
    provider: CARDLINK_PAYMENT_PROVIDER,
    orderUuid: input.orderUuid,
    chargeId: input.billId,
    validate: (order) => {
      if (input.currency.toUpperCase() !== order.currency) {
        Sentry.captureMessage("Cardlink webhook currency mismatch", {
          level: "error",
          tags: { component: "cardlink", reason: "currency_mismatch" },
          extra: {
            orderUuid: input.orderUuid,
            expected: order.currency,
            received: input.currency,
          },
        });
        return false;
      }

      const cents = usdAmountToCents(input.amount);
      if (cents === null || cents !== order.priceAmount) {
        Sentry.captureMessage("Cardlink webhook amount mismatch", {
          level: "error",
          tags: { component: "cardlink", reason: "amount_mismatch" },
          extra: {
            orderUuid: input.orderUuid,
            expected: order.priceAmount.toString(),
            received: input.amount,
          },
        });
        return false;
      }
      return true;
    },
  });
}

export async function failCardlinkPayment(orderUuid: string) {
  await failPendingPayment(orderUuid, CARDLINK_PAYMENT_PROVIDER);
}

export async function markCardlinkRefunded(input: {
  orderUuid: string;
  refundId: string;
  amount: string;
  currency: string;
}) {
  const cents = usdAmountToCents(input.amount);
  if (cents === null) {
    return;
  }

  await db.order.updateMany({
    where: {
      orderUuid: input.orderUuid,
      paymentProvider: CARDLINK_PAYMENT_PROVIDER,
      currency: input.currency.toUpperCase(),
      OR: [
        { paymentStatus: paymentStatus.paid },
        {
          paymentStatus: paymentStatus.refunded,
          paymentRefundId: input.refundId,
        },
      ],
    },
    data: {
      paymentStatus: paymentStatus.refunded,
      paymentRefundId: input.refundId,
      refundedAmount: cents,
    },
  });
}

export async function markCardlinkChargeback(input: {
  orderUuid: string;
  chargebackId: string;
}) {
  await db.order.updateMany({
    where: {
      orderUuid: input.orderUuid,
      paymentProvider: CARDLINK_PAYMENT_PROVIDER,
      OR: [
        { paymentStatus: paymentStatus.paid },
        { paymentStatus: paymentStatus.refunded },
        {
          paymentStatus: paymentStatus.chargeback,
          paymentChargebackId: input.chargebackId,
        },
      ],
    },
    data: {
      paymentStatus: paymentStatus.chargeback,
      paymentChargebackId: input.chargebackId,
    },
  });
}

export async function syncPendingProfilesForUser(userId: string) {
  const pending = await db.order.findMany({
    where: {
      userId,
      esimIccid: null,
      status: { in: [orderStatus.paid, orderStatus.ordering] },
    },
  });

  for (const order of pending) {
    if (order.resellerOrderId) {
      try {
        await syncEsimProfile(order);
      } catch (error) {
        Sentry.captureException(error, {
          tags: { component: "esimaccess", reason: "query_failed" },
          extra: { orderUuid: order.orderUuid },
        });
      }
    } else if (order.paymentStatus === paymentStatus.paid) {
      await placeSupplierOrder(order);
    }
  }
}

export async function findOrderForResource(input: {
  orderNo: string | null;
  transactionId: string | null;
}) {
  if (input.transactionId) {
    try {
      const byUuid = await db.order.findUnique({
        where: { orderUuid: input.transactionId },
      });
      if (byUuid) return byUuid;
    } catch {
      // transactionId is not our UUID; fall through to orderNo.
    }
  }

  if (!input.orderNo) {
    return null;
  }

  return db.order.findFirst({
    where: {
      resellerCode: "esimaccess",
      resellerOrderId: input.orderNo,
    },
  });
}

export async function attachGotResource(input: {
  orderNo: string | null;
  transactionId: string | null;
}) {
  const order = await findOrderForResource(input);

  if (!order) {
    return;
  }
  if (order.status === orderStatus.issued && order.esimIccid) {
    return;
  }

  const resellerOrderId = order.resellerOrderId ?? input.orderNo;
  if (!resellerOrderId) {
    return;
  }

  if (!order.resellerOrderId && input.orderNo) {
    await db.order.updateMany({
      where: {
        id: order.id,
        resellerOrderId: null,
        status: { in: [orderStatus.paid, orderStatus.ordering] },
      },
      data: { resellerOrderId: input.orderNo, status: orderStatus.ordering },
    });
  }

  await syncEsimProfile({
    ...order,
    resellerOrderId,
    status: order.resellerOrderId ? order.status : orderStatus.ordering,
  });
}

export async function applyEsimStatus(input: {
  iccid: string | null;
  orderNo: string | null;
  transactionId: string | null;
  esimStatus: string | null;
  smdpStatus: string | null;
}) {
  let order = input.iccid
    ? await db.order.findFirst({ where: { esimIccid: input.iccid } })
    : null;

  order ??= await findOrderForResource({
    orderNo: input.orderNo,
    transactionId: input.transactionId,
  });

  if (!order) {
    return;
  }

  const esimStatus =
    input.esimStatus && isEsimLifecycleStatus(input.esimStatus)
      ? input.esimStatus
      : undefined;

  await db.order.update({
    where: { id: order.id },
    data: {
      ...(esimStatus ? { esimStatus } : {}),
      ...(input.smdpStatus ? { esimSmdpStatus: input.smdpStatus } : {}),
      ...(input.iccid && !order.esimIccid ? { esimIccid: input.iccid } : {}),
    },
  });
}
