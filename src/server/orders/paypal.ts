import "server-only";

import { db } from "~/server/db";
import { PAYPAL_PAYMENT_PROVIDER } from "~/lib/order-status";
import {
  getPaypalOrder,
  capturePaypalOrder,
  paypalAmountToMinor,
  type PaypalOrder,
} from "~/server/payments/paypal";
import { fulfillPaypalPayment } from "./fulfill";

export async function applyVerifiedPaypalOrder(payment: PaypalOrder) {
  const unit = payment.purchaseUnits[0]!;
  const order = await db.order.findUnique({
    where: { orderUuid: unit.customId },
  });
  if (order?.paymentProvider !== PAYPAL_PAYMENT_PROVIDER)
    throw new Error("PayPal order not found");
  if (order.paymentInvoiceId && order.paymentInvoiceId !== payment.id)
    throw new Error("PayPal invoice mismatch");
  // The merchant API custom_id recovers an invoice whose creation response was lost.
  await db.order.updateMany({
    where: { id: order.id, paymentInvoiceId: null },
    data: { paymentInvoiceId: payment.id },
  });
  const captures = unit.payments?.captures ?? [];
  if (payment.status !== "COMPLETED" || !captures.length) return false;
  if (captures.length !== 1)
    throw new Error("Unexpected PayPal split capture; manual review required");
  const capture = captures[0]!;
  if (capture.status !== "COMPLETED") return false;
  await fulfillPaypalPayment({
    orderUuid: order.orderUuid,
    captureId: capture.id,
    amount: paypalAmountToMinor(capture.amount.value),
    currency: capture.amount.currencyCode,
  });
  return true;
}

export async function reconcilePaypalOrder(id: string) {
  let payment = await getPaypalOrder(id);
  if (payment.id !== id) throw new Error("PayPal response ID mismatch");
  const unit = payment.purchaseUnits[0]!;
  const order = await db.order.findUnique({
    where: { orderUuid: unit.customId },
  });
  if (
    order?.paymentProvider !== PAYPAL_PAYMENT_PROVIDER ||
    (order.paymentInvoiceId && order.paymentInvoiceId !== id)
  )
    throw new Error("PayPal invoice mismatch");
  if (payment.status === "APPROVED") {
    if (
      unit.amount.currencyCode !== order.currency ||
      paypalAmountToMinor(unit.amount.value) !== order.priceAmount
    ) {
      throw new Error("PayPal approval amount mismatch");
    }
    try {
      payment = await capturePaypalOrder(id);
    } catch (error) {
      // Another callback may have captured already, or its response was lost.
      payment = await getPaypalOrder(id);
      if (payment.status !== "COMPLETED") throw error;
    }
  }
  if (payment.id !== id) throw new Error("PayPal response ID mismatch");
  return applyVerifiedPaypalOrder(payment);
}
