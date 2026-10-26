import "server-only";

import { processUnitpayRefund } from "~/server/refunds/unitpay";
import * as Sentry from "@sentry/nextjs";
import {
  orderStatus,
  paymentStatus,
  XHUB_PAYMENT_PROVIDER,
  UNITPAY_PAYMENT_PROVIDER,
  TRYBIT_PAYMENT_PROVIDER,
} from "~/lib/order-status";
import { refundStatus } from "~/lib/refund-status";
import { db } from "~/server/db";
import {
  createXhubRefund,
  getXhubRefund,
  type XhubRefund,
} from "~/server/payments/xhub";
import { ensureRefund, type RefundOrder } from "~/server/refunds/store";
import { notifyBuyerRefundNotice } from "~/server/telegram/refund-notice";

const TOPUP_REFUND_REASON =
  "Top-up cannot be fulfilled because the parent eSIM is unavailable.";
const ISSUE_FAILED_REFUND_REASON =
  "Provider could not issue eSIM (insufficient merchant balance).";

function bareId(id: string) {
  return id.replace(/^(pay_|ref_)/, "");
}

async function refundFailed(order: RefundOrder, error: unknown) {
  const refund = await db.refund.findUnique({ where: { orderId: order.id } });
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
      refundId: refund?.providerRefundId,
      refundRequestId: refund?.id,
      amount: order.priceAmount.toString(),
      currency: order.currency,
      manualRefundRequired: true,
    },
  });
  await db.$transaction(async (tx) => {
    const changed = await tx.order.updateMany({
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
    if (!changed.count) return;
    await tx.refund.updateMany({
      where: {
        orderId: order.id,
        status: { in: [refundStatus.requested, refundStatus.processing] },
      },
      data: {
        status: refundStatus.manualReview,
        failureCode: "refund_reconciliation_required",
      },
    });
  });
}

export async function applyXhubRefund(
  order: RefundOrder,
  response: XhubRefund,
) {
  if (
    !order.paymentChargeId ||
    bareId(response.payment_id) !== bareId(order.paymentChargeId)
  )
    throw new Error("X-Hub refund payment ID mismatch");
  const amount = BigInt(response.amount_rub.replace(".", ""));
  if (order.currency !== "RUB" || amount !== order.priceAmount)
    throw new Error(
      "X-Hub refund amount or currency mismatch; reconcile manually",
    );
  const result = await db.$transaction(async (tx) => {
    const current = await tx.order.update({
      where: { id: order.id },
      data: { id: order.id },
    });
    const refund = await tx.refund.findUniqueOrThrow({
      where: { orderId: order.id },
    });
    if (
      refund.providerRefundId &&
      bareId(response.id) !== bareId(refund.providerRefundId)
    )
      throw new Error("X-Hub refund ID mismatch");
    if (refund.amount !== amount || refund.currency !== order.currency)
      throw new Error("Refund request amount or currency mismatch");
    if (
      current.paymentStatus !== paymentStatus.paid &&
      current.paymentStatus !== paymentStatus.refunded
    )
      return { failed: false, justCompleted: false };
    if (
      refund.status === refundStatus.reversed &&
      response.status !== "reversed"
    )
      return { failed: false, justCompleted: false };
    if (
      refund.status === refundStatus.completed &&
      response.status !== "completed" &&
      response.status !== "reversed"
    )
      return { failed: false, justCompleted: false };
    if (response.status === "completed") {
      const justCompleted = refund.status !== refundStatus.completed;
      await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: refundStatus.completed,
          providerRefundId: response.id,
          providerStatus: response.status,
          completedAt: refund.completedAt ?? new Date(),
          failureCode: null,
        },
      });
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: orderStatus.refunded,
          paymentStatus: paymentStatus.refunded,
          refundedAmount: amount,
          failureReason: null,
        },
      });
      return { failed: false, justCompleted };
    } else if (
      ["rejected", "failed", "cancelled", "reversed"].includes(response.status)
    ) {
      await tx.refund.update({
        where: { id: refund.id },
        data: {
          status:
            response.status === "reversed"
              ? refundStatus.reversed
              : refundStatus.failed,
          providerRefundId: response.id,
          providerStatus: response.status,
          failureCode: "provider_" + response.status,
        },
      });
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: orderStatus.refundRequired,
          paymentStatus: paymentStatus.paid,
          refundedAmount: null,
          failureReason: "topup_refund_" + response.status,
        },
      });
      return {
        failed:
          refund.status !== refundStatus.failed &&
          refund.status !== refundStatus.reversed,
        justCompleted: false,
      };
    } else if (
      refund.status !== refundStatus.completed &&
      refund.status !== refundStatus.reversed
    ) {
      await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: refundStatus.processing,
          providerRefundId: response.id,
          providerStatus: response.status,
          failureCode: null,
        },
      });
    }
    return { failed: false, justCompleted: false };
  });
  if (result.failed) {
    await refundFailed(
      order,
      new Error("X-Hub refund " + response.status + "; manual refund required"),
    );
  }
  if (result.justCompleted) {
    await notifyBuyerRefundNotice(order.id);
  }
}

export async function processPendingRefund(orderId: bigint) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (
    order?.status !== orderStatus.refundPending ||
    order.paymentStatus !== paymentStatus.paid
  )
    return;
  const existing = await db.refund.findUnique({ where: { orderId: order.id } });
  const refund = await ensureRefund(order, {
    source: "automatic",
    reason:
      existing?.reason ??
      (order.topupOfOrderId !== null
        ? TOPUP_REFUND_REASON
        : ISSUE_FAILED_REFUND_REASON),
  });
  try {
    if (order.paymentProvider === UNITPAY_PAYMENT_PROVIDER) {
      await processUnitpayRefund(order);
      return;
    }
    if (order.paymentProvider === TRYBIT_PAYMENT_PROVIDER)
      throw new Error(
        "Trybit automatic refund unavailable: manual refund needs a verified recipient wallet and payout credentials",
      );
    if (
      order.paymentProvider !== XHUB_PAYMENT_PROVIDER ||
      !order.paymentChargeId
    )
      throw new Error(
        "Automatic refund unavailable: unsupported provider or missing payment ID",
      );
    const response = refund.providerRefundId
      ? await getXhubRefund(refund.providerRefundId)
      : await createXhubRefund({
          paymentId: order.paymentChargeId,
          orderUuid: order.orderUuid,
          idempotencyKey: refund.idempotencyKey,
          reason: refund.reason,
        });
    await applyXhubRefund(order, response);
  } catch (error) {
    await refundFailed(order, error);
  }
}

export async function requestTopupRefund(
  orderId: bigint,
  uncertainSupplierOutcome = false,
): Promise<boolean> {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  const claimed = await db.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
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
        failureReason: uncertainSupplierOutcome
          ? "topup_outcome_unknown"
          : "topup_parent_unavailable",
      },
    });
    if (result.count) {
      const refund = await ensureRefund(
        order,
        {
          source: "automatic",
          reason: TOPUP_REFUND_REASON,
        },
        tx,
      );
      if (uncertainSupplierOutcome)
        await tx.refund.update({
          where: { id: refund.id },
          data: {
            status: refundStatus.manualReview,
            failureCode: "supplier_outcome_unknown",
          },
        });
    }
    return result.count;
  });
  if (!claimed) return false;
  if (uncertainSupplierOutcome) {
    await refundFailed(
      order,
      new Error(
        "Automatic refund requires manual reconciliation: a previous supplier top-up may have succeeded",
      ),
    );
    return true;
  }
  await processPendingRefund(orderId);
  return true;
}

/** Auto-refund a new eSIM purchase after confirmed supplier balance failure. */
export async function requestIssueFailedRefund(
  orderId: bigint,
): Promise<boolean> {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  const claimed = await db.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
      where: {
        id: orderId,
        topupOfOrderId: null,
        resellerOrderId: null,
        esimIccid: null,
        status: { in: [orderStatus.ordering, orderStatus.paid] },
        paymentStatus: paymentStatus.paid,
      },
      data: {
        status: orderStatus.refundPending,
        failureReason: "supplier_balance_insufficient",
      },
    });
    if (result.count) {
      await ensureRefund(
        order,
        {
          source: "automatic",
          reason: ISSUE_FAILED_REFUND_REASON,
        },
        tx,
      );
    }
    return result.count;
  });
  if (!claimed) return false;
  await processPendingRefund(orderId);
  return true;
}

/** Reconcile authoritative REST state, including reversals and late completion. */
export async function syncXhubRefund(input: {
  paymentId: string;
  refundId: string;
}) {
  const paymentId = bareId(input.paymentId);
  const order = await db.order.findFirst({
    where: {
      paymentProvider: XHUB_PAYMENT_PROVIDER,
      paymentChargeId: { in: [paymentId, "pay_" + paymentId] },
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
  const refund = await db.refund.findUnique({ where: { orderId: order.id } });
  if (
    !refund ||
    (refund.providerRefundId &&
      bareId(refund.providerRefundId) !== bareId(input.refundId))
  )
    return;
  try {
    await applyXhubRefund(order, await getXhubRefund(input.refundId));
  } catch (error) {
    await refundFailed(order, error);
    throw error;
  }
}
