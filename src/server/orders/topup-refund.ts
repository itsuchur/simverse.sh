import "server-only";

import * as Sentry from "@sentry/nextjs";
import {
  orderStatus,
  paymentStatus,
  XHUB_PAYMENT_PROVIDER,
  TRYBIT_PAYMENT_PROVIDER,
} from "~/lib/order-status";
import { db } from "~/server/db";
import {
  createXhubRefund,
  getXhubRefund,
  type XhubRefund,
} from "~/server/payments/xhub";

type RefundOrder = {
  id: bigint;
  orderUuid: string;
  topupOfOrderId: bigint | null;
  paymentProvider: string;
  paymentChargeId: string | null;
  paymentRefundId: string | null;
  paymentRefundKey: string;
  priceAmount: bigint;
  currency: string;
  refundReason: string | null;
};

function bareId(id: string) {
  return id.replace(/^(pay_|ref_)/, "");
}

async function refundFailed(order: RefundOrder, error: unknown) {
  Sentry.captureException(error, {
    level: "error",
    tags: {
      component: "payments",
      payment_provider: order.paymentProvider,
      reason: "topup_refund_failed",
    },
    extra: {
      orderUuid: order.orderUuid,
      parentOrderId: order.topupOfOrderId?.toString(),
      paymentChargeId: order.paymentChargeId,
      refundId: order.paymentRefundId,
      refundKey: order.paymentRefundKey,
      amount: order.priceAmount.toString(),
      currency: order.currency,
      manualRefundRequired: true,
    },
  });
  await db.order.updateMany({
    where: {
      id: order.id,
      status: orderStatus.refundPending,
      paymentStatus: paymentStatus.paid,
    },
    data: {
      status: orderStatus.refundRequired,
      failureReason: "topup_refund_failed",
    },
  });
}

export async function applyXhubRefund(order: RefundOrder, refund: XhubRefund) {
  if (
    !order.paymentChargeId ||
    bareId(refund.payment_id) !== bareId(order.paymentChargeId)
  ) {
    throw new Error("X-Hub refund payment ID mismatch");
  }
  if (
    order.paymentRefundId &&
    bareId(refund.id) !== bareId(order.paymentRefundId)
  ) {
    throw new Error("X-Hub refund ID mismatch");
  }
  const amount = BigInt(refund.amount_rub.replace(".", ""));
  if (order.currency !== "RUB" || amount !== order.priceAmount) {
    throw new Error(
      "X-Hub refund amount or currency mismatch; reconcile manually",
    );
  }

  const where = {
    id: order.id,
    status: {
      in: [
        orderStatus.refundPending,
        orderStatus.refundRequired,
        orderStatus.refunded,
      ],
    },
    paymentStatus: { in: [paymentStatus.paid, paymentStatus.refunded] },
  };
  if (refund.status === "completed") {
    await db.order.updateMany({
      where,
      data: {
        status: orderStatus.refunded,
        paymentStatus: paymentStatus.refunded,
        paymentRefundId: refund.id,
        refundedAmount: amount,
        failureReason: null,
      },
    });
  } else if (
    ["rejected", "failed", "cancelled", "reversed"].includes(refund.status)
  ) {
    const changed = await db.order.updateMany({
      where: {
        ...where,
        status: { in: [orderStatus.refundPending, orderStatus.refunded] },
      },
      data: {
        status: orderStatus.refundRequired,
        paymentStatus: paymentStatus.paid,
        paymentRefundId: refund.id,
        refundedAmount: null,
        failureReason: `topup_refund_${refund.status}`,
      },
    });
    if (changed.count > 0) {
      await refundFailed(
        order,
        new Error(`X-Hub refund ${refund.status}; manual refund required`),
      );
    }
  } else {
    // A request/executing response is not proof that the customer got their money.
    await db.order.updateMany({
      where: {
        id: order.id,
        status: orderStatus.refundPending,
        paymentStatus: paymentStatus.paid,
      },
      data: { paymentRefundId: refund.id, updatedAt: new Date() },
    });
  }
}

export async function processPendingRefund(orderId: bigint) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (
    !order ||
    (!order.topupOfOrderId && !order.refundReason) ||
    order.status !== orderStatus.refundPending ||
    order.paymentStatus !== paymentStatus.paid
  )
    return;
  try {
    if (order.paymentProvider === TRYBIT_PAYMENT_PROVIDER) {
      // The documented cancellation API accepts unpaid invoices only. A payout
      // needs a separate key plus a verified recipient wallet, neither is stored.
      throw new Error(
        "Trybit automatic refund unavailable: manual refund needs a verified recipient wallet and payout credentials",
      );
    }
    if (
      order.paymentProvider !== XHUB_PAYMENT_PROVIDER ||
      !order.paymentChargeId
    ) {
      throw new Error(
        "Automatic top-up refund unavailable: unsupported provider or missing payment ID",
      );
    }
    const refund = order.paymentRefundId
      ? await getXhubRefund(order.paymentRefundId)
      : await createXhubRefund({
          paymentId: order.paymentChargeId,
          orderUuid: order.orderUuid,
          idempotencyKey: order.paymentRefundKey,
          reason:
            order.refundReason ??
            "Top-up cannot be fulfilled because the parent eSIM is unavailable.",
        });
    await applyXhubRefund(order, refund);
  } catch (error) {
    await refundFailed(order, error);
  }
}

export async function requestTopupRefund(
  orderId: bigint,
  uncertainSupplierOutcome = false,
) {
  const claimed = await db.order.updateMany({
    where: {
      id: orderId,
      topupOfOrderId: { not: null },
      status: orderStatus.ordering,
      paymentStatus: paymentStatus.paid,
    },
    data: {
      status: uncertainSupplierOutcome
        ? orderStatus.refundRequired
        : orderStatus.refundPending,
      refundReason:
        "Top-up cannot be fulfilled because the parent eSIM is unavailable.",
      failureReason: uncertainSupplierOutcome
        ? "topup_outcome_unknown"
        : "topup_parent_unavailable",
    },
  });
  if (claimed.count === 0) return;
  if (uncertainSupplierOutcome) {
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    await refundFailed(
      order,
      new Error(
        "Automatic refund requires manual reconciliation: a previous supplier top-up may have succeeded",
      ),
    );
    return;
  }
  await processPendingRefund(orderId);
}

/** Fetch the current REST state so duplicate/out-of-order events cannot undo it. */
export async function syncXhubRefund(input: {
  paymentId: string;
  refundId: string;
}) {
  const paymentId = bareId(input.paymentId);
  const order = await db.order.findFirst({
    where: {
      paymentProvider: XHUB_PAYMENT_PROVIDER,
      paymentChargeId: { in: [paymentId, `pay_${paymentId}`] },
      status: {
        in: [
          orderStatus.refundPending,
          orderStatus.refundRequired,
          orderStatus.refunded,
        ],
      },
    },
  });
  if (!order) return;
  if (
    order.paymentRefundId &&
    bareId(order.paymentRefundId) !== bareId(input.refundId)
  )
    return;
  try {
    await applyXhubRefund(order, await getXhubRefund(input.refundId));
  } catch (error) {
    await refundFailed(order, error);
    // Ask the provider to retry if its state cannot be reconciled yet.
    throw error;
  }
}
