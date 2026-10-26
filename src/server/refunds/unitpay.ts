import "server-only";
import { UNITPAY_PAYMENT_PROVIDER } from "~/lib/order-status";
import { refundStatus } from "~/lib/refund-status";
import { db } from "~/server/db";
import {
  getUnitpayPayment,
  refundUnitpayPayment,
  unitpayAmountToMinor,
  validateUnitpayPayment,
} from "~/server/payments/unitpay";
import { recordCompletedRefund, type RefundOrder } from "./store";

/** Claim once before sending: Unitpay has no merchant idempotency key for refunds. */
export async function processUnitpayRefund(order: RefundOrder) {
  if (
    order.paymentProvider !== UNITPAY_PAYMENT_PROVIDER ||
    !order.paymentChargeId
  )
    throw new Error("Invalid Unitpay refund order");
  const refund = await db.refund.findUniqueOrThrow({
    where: { orderId: order.id },
  });
  if (refund.status === refundStatus.completed) return;
  const payment = await getUnitpayPayment(order.paymentChargeId);
  validateUnitpayPayment(payment, { ...order, paymentInvoiceId: null });
  // getPayment documents no refunded-amount field. A refund status alone
  // cannot distinguish a full refund from Unitpay's single allowed partial refund.
  // Unknown submissions therefore require manual reconciliation, never a resend.
  if (refund.status !== refundStatus.requested)
    throw new Error(
      "Unitpay refund outcome needs reconciliation; request will not be repeated",
    );
  if (
    payment.status !== "success" ||
    Number(payment.isPreauth) !== 0 ||
    payment.refunds.length ||
    unitpayAmountToMinor(payment.availableForRefund) !== order.priceAmount
  )
    throw new Error("Unitpay payment is not eligible for a full refund");
  const claimed = await db.refund.updateMany({
    where: { id: refund.id, status: refundStatus.requested },
    data: { status: refundStatus.processing, providerStatus: "submitting" },
  });
  if (!claimed.count) throw new Error("Unitpay refund is already processing");
  try {
    await refundUnitpayPayment(order.paymentChargeId);
    await complete(order);
  } catch {
    await db.refund.updateMany({
      where: { id: refund.id, status: refundStatus.processing },
      data: {
        status: refundStatus.manualReview,
        failureCode: "refund_reconciliation_required",
      },
    });
    throw new Error(
      "Unitpay refund outcome unknown; reconcile before retrying",
    );
  }
}

async function complete(order: RefundOrder) {
  await recordCompletedRefund({
    orderUuid: order.orderUuid,
    provider: UNITPAY_PAYMENT_PROVIDER,
    paymentId: order.paymentChargeId!,
    refundId: order.paymentChargeId!,
    amount: order.priceAmount,
    currency: order.currency,
  });
}
