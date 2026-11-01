import "server-only";
import { db } from "~/server/db";
import { CODAPAY_PAYMENT_PROVIDER } from "~/lib/order-status";
import {
  codapayAmountToMinor,
  getCodapayPayment,
} from "~/server/payments/codapay";
import { failCodapayPayment, fulfillCodapayPayment } from "./fulfill";

export async function reconcileCodapayPayment(
  txnId: string,
  orderUuid: string,
) {
  const order = await db.order.findUnique({ where: { orderUuid } });
  if (
    order?.paymentProvider !== CODAPAY_PAYMENT_PROVIDER ||
    (order.paymentInvoiceId && order.paymentInvoiceId !== txnId)
  )
    throw new Error("Codapay invoice mismatch");
  const payment = await getCodapayPayment(txnId);
  if (payment.orderId !== orderUuid) throw new Error("Codapay order mismatch");
  if (["431", "481", "216"].includes(payment.resultCode)) return "pending";
  if (payment.resultCode !== "0") {
    await failCodapayPayment(orderUuid);
    return "fail";
  }
  if (
    payment.originCurrency !== "USD" ||
    !payment.originAmount ||
    order.currency !== "USD" ||
    codapayAmountToMinor(payment.originAmount) !== order.priceAmount
  )
    throw new Error("Codapay USD amount mismatch");
  await db.order.updateMany({
    where: { id: order.id, paymentInvoiceId: null },
    data: { paymentInvoiceId: txnId },
  });
  await fulfillCodapayPayment({
    orderUuid,
    transactionId: txnId,
    amount: order.priceAmount,
  });
  return "success";
}
