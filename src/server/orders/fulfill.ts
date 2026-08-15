import "server-only";

import * as Sentry from "@sentry/nextjs";

import { clearCart } from "~/server/cart";
import { db } from "~/server/db";
import {
  orderEsimAccessPackage,
  queryEsimAccessProfiles,
  type EsimAccessProfile,
} from "~/server/suppliers/esimaccess/order";
import {
  orderStatus,
  paymentStatus,
  STARS_PAYMENT_PROVIDER,
} from "~/lib/order-status";

export { orderStatus, paymentStatus, STARS_PAYMENT_PROVIDER };

type OrderRow = {
  id: bigint;
  orderUuid: string;
  userId: string;
  resellerPlanId: string;
  resellerOrderId: string | null;
  status: string;
  esimIccid: string | null;
};

function applyProfile(
  orderId: bigint,
  profile: EsimAccessProfile,
  extra?: { resellerOrderId?: string },
) {
  return db.order.update({
    where: { id: orderId },
    data: {
      status: orderStatus.issued,
      issuedAt: new Date(),
      esimIccid: profile.iccid,
      esimActivationCode: profile.ac,
      esimQrUrl: profile.qrCodeUrl,
      esimSmdpAddress: profile.smdpAddress,
      ...(extra?.resellerOrderId
        ? { resellerOrderId: extra.resellerOrderId }
        : {}),
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

export async function placeSupplierOrder(order: OrderRow) {
  if (order.resellerOrderId) {
    await syncEsimProfile(order);
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
    await db.order.update({
      where: { id: order.id },
      data: {
        status: orderStatus.failed,
        failureReason: error instanceof Error ? error.message : "order_failed",
      },
    });
  }
}

async function supersedePendingStarsDrafts(order: {
  id: bigint;
  userId: string;
  resellerPlanId: string;
}) {
  await db.order.updateMany({
    where: {
      userId: order.userId,
      id: { not: order.id },
      paymentProvider: STARS_PAYMENT_PROVIDER,
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

export async function fulfillStarsPayment(input: {
  orderUuid: string;
  telegramPaymentChargeId: string;
  telegramId: string;
}) {
  const alreadyCharged = await db.order.findFirst({
    where: {
      paymentProvider: STARS_PAYMENT_PROVIDER,
      paymentChargeId: input.telegramPaymentChargeId,
    },
  });
  if (alreadyCharged) {
    await supersedePendingStarsDrafts(alreadyCharged);
    await placeSupplierOrder(alreadyCharged);
    return;
  }

  const pending = await db.order.findUnique({
    where: { orderUuid: input.orderUuid },
  });
  if (!pending || pending.paymentStatus !== paymentStatus.pending) {
    return;
  }

  try {
    const paid = await db.order.update({
      where: { id: pending.id },
      data: {
        paymentStatus: paymentStatus.paid,
        paymentChargeId: input.telegramPaymentChargeId,
        paidAt: new Date(),
        status: orderStatus.paid,
      },
    });

    await clearCart(input.telegramId);
    await supersedePendingStarsDrafts(paid);
    await placeSupplierOrder(paid);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const charged = await db.order.findFirst({
        where: {
          paymentProvider: STARS_PAYMENT_PROVIDER,
          paymentChargeId: input.telegramPaymentChargeId,
        },
      });
      if (charged) {
        await supersedePendingStarsDrafts(charged);
        await placeSupplierOrder(charged);
      }
      return;
    }
    throw error;
  }
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

async function findOrderForResource(input: {
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
    await db.order.update({
      where: { id: order.id },
      data: { resellerOrderId: input.orderNo, status: orderStatus.ordering },
    });
  }

  await syncEsimProfile({
    ...order,
    resellerOrderId,
    status: order.resellerOrderId ? order.status : orderStatus.ordering,
  });
}
