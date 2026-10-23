import "server-only";

import { dashboardReasonSchema } from "~/lib/dashboard-reason";
import { createXhubRefund, getXhubRefund } from "~/server/payments/xhub";
import { applyXhubRefund } from "~/server/orders/topup-refund";

import {
  PLATEGA_PAYMENT_PROVIDER,
  XHUB_PAYMENT_PROVIDER,
  orderStatus,
  paymentStatus,
} from "~/lib/order-status";
import { db } from "~/server/db";
import { markPlategaRefunded } from "~/server/orders/fulfill";
import {
  cancelPlategaTransaction,
  checkPlategaCancelSupported,
} from "~/server/payments/platega";
import {
  cancelEsimAccessProfile,
  isUnusedEsimAccessProfile,
  queryEsimAccessProfiles,
} from "~/server/suppliers/esimaccess/order";

export async function refundDashboardOrder(orderUuid: string, reason: string) {
  const refundReason = dashboardReasonSchema.parse(reason);

  const order = await db.order.findUnique({
    where: { orderUuid },
    select: {
      id: true,
      status: true,
      topupOfOrderId: true,
      currency: true,
      refundReason: true,
      paymentRefundId: true,
      paymentRefundKey: true,
      orderUuid: true,
      paymentProvider: true,
      paymentStatus: true,
      paymentChargeId: true,
      priceAmount: true,
      resellerOrderId: true,
      esimIccid: true,
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }
  if (
    ![PLATEGA_PAYMENT_PROVIDER, XHUB_PAYMENT_PROVIDER].includes(
      order.paymentProvider,
    )
  ) {
    throw new Error("This payment provider does not support dashboard refunds");
  }
  if (order.topupOfOrderId)
    throw new Error(
      "Top-up refunds require manual review; the parent eSIM must not be cancelled",
    );
  if (order.status === orderStatus.ordering)
    throw new Error("Order fulfillment is in progress; try again later");
  if (order.paymentStatus !== paymentStatus.paid) {
    throw new Error("Order is not in a refundable paid state");
  }
  if (!order.paymentChargeId) {
    throw new Error("Order is missing the payment transaction id");
  }

  const isXhub = order.paymentProvider === XHUB_PAYMENT_PROVIDER;
  if (isXhub && order.currency !== "RUB")
    throw new Error("X-Hub refund requires RUB");
  if (order.refundReason && order.refundReason !== refundReason) {
    throw new Error(
      "A refund has already been requested with a different reason",
    );
  }
  const profile = order.resellerOrderId
    ? (await queryEsimAccessProfiles(order.resellerOrderId))[0]
    : undefined;
  if (order.resellerOrderId && !profile)
    throw new Error("Supplier profile not found; refund needs manual review");
  const alreadyCancelled =
    profile?.esimStatus === "CANCEL" || profile?.esimStatus === "REVOKED";
  if (profile && !alreadyCancelled && !isUnusedEsimAccessProfile(profile))
    throw new Error("eSIM is activated; refund is not possible");
  if (profile && !alreadyCancelled && !profile.esimTranNo)
    throw new Error("eSIM is missing esimTranNo; cannot cancel with supplier");
  const claimed = await db.order.updateMany({
    where: {
      id: order.id,
      paymentStatus: paymentStatus.paid,
      status: order.status,
      refundReason: order.refundReason,
    },
    data: { refundReason, status: orderStatus.refundRequired },
  });
  if (!claimed.count) throw new Error("Order changed; refresh and try again");
  if (profile && !alreadyCancelled && profile.esimTranNo) {
    await cancelEsimAccessProfile(profile.esimTranNo);
    await db.order.update({
      where: { orderUuid },
      data: {
        esimStatus: "CANCEL",
        ...(profile.iccid && !order.esimIccid
          ? { esimIccid: profile.iccid }
          : {}),
      },
    });
  }

  if (isXhub) {
    // Persist the request before contacting X-Hub. Retries reuse both reason and UUID.
    const pending = await db.order.updateMany({
      where: {
        id: order.id,
        paymentStatus: paymentStatus.paid,
        status: orderStatus.refundRequired,
      },
      data: { status: orderStatus.refundPending },
    });
    if (!pending.count)
      throw new Error("Order changed; refresh to see the refund status");
    const refund = order.paymentRefundId
      ? await getXhubRefund(order.paymentRefundId)
      : await createXhubRefund({
          paymentId: order.paymentChargeId,
          orderUuid,
          idempotencyKey: order.paymentRefundKey,
          reason: refundReason,
        });
    await applyXhubRefund({ ...order, refundReason }, refund);
    if (
      ["rejected", "failed", "cancelled", "reversed"].includes(refund.status)
    ) {
      throw new Error(`X-Hub refund ${refund.status}; manual review required`);
    }
    return { pending: refund.status !== "completed" };
  }

  const cancelSupported = await checkPlategaCancelSupported(
    order.paymentChargeId,
  );
  if (!cancelSupported.supported) {
    throw new Error(
      cancelSupported.blockReason ?? "Platega cancel is not supported",
    );
  }

  const cancelResult = await cancelPlategaTransaction(order.paymentChargeId);
  if (!cancelResult.accepted || cancelResult.manualControlRequired) {
    throw new Error(cancelResult.message || "Platega refund was not accepted");
  }

  await markPlategaRefunded({
    orderUuid: order.orderUuid,
    transactionId: order.paymentChargeId,
    refundedAmount: order.priceAmount,
  });

  await db.order.updateMany({
    where: { id: order.id, paymentStatus: paymentStatus.refunded },
    data: { status: orderStatus.refunded },
  });
  return { pending: false };
}
