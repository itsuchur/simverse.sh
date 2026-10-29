import { paypalConfigured } from "~/server/payments/paypal";
import { reconcilePaypalOrder } from "./paypal";
import "server-only";

import { getUnitpayPayment, unitpayConfigured, unitpayAmountToMinor, validateUnitpayPayment } from "~/server/payments/unitpay";
import { fulfillUnitpayPayment } from "./fulfill";

import * as Sentry from "@sentry/nextjs";
import { db } from "~/server/db";
import { failTrybitPayment, failXhubPayment, fulfillTrybitPayment, fulfillXhubPayment, holdCapturedPaymentMismatch, markXhubRefunded } from "./fulfill";
import { findTrybitInvoice, getTrybitInvoice, normalizeTrybitInvoiceId, trybitConfigured, type TrybitInvoiceStatus } from "~/server/payments/trybit";
import { findXhubPayment, getXhubPayment, xhubConfigured, type XhubPaymentState } from "~/server/payments/xhub";
import { XHUB_PAYMENT_PROVIDER } from "~/lib/order-status";

/** An abandoned Trybit checkout leaves My eSIMs once this long. A later payment still fulfills. */
export const TRYBIT_UNPAID_TTL_MS = 12 * 60 * 60 * 1000;

function unpaidTrybitExpired(createdAt: Date, now: Date) {
  return now.getTime() - createdAt.getTime() >= TRYBIT_UNPAID_TTL_MS;
}

function bareXhubId(id: string) {
  return id.replace(/^pay_/, "");
}

function rubStringToKopecks(amount: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  return BigInt(Math.round(value * 100));
}

/** Trust the X-Hub payment record, not the webhook body that pointed at it. */
export async function applyVerifiedXhubPayment(orderUuid: string, payment: XhubPaymentState) {
  if (payment.external_id !== orderUuid) throw new Error("X-Hub payment order mismatch");
  const order = await db.order.findUnique({ where: { orderUuid } });
  if (order?.paymentProvider !== XHUB_PAYMENT_PROVIDER) return;
  if (order.paymentInvoiceId && bareXhubId(order.paymentInvoiceId) !== bareXhubId(payment.id)) {
    throw new Error("X-Hub payment ID mismatch");
  }
  await db.order.updateMany({
    where: { id: order.id, paymentInvoiceId: null },
    data: { paymentInvoiceId: payment.id },
  });

  if (payment.status === "paid" || payment.status === "settled") {
    await fulfillXhubPayment({
      orderUuid,
      paymentId: payment.id,
      amountRub: payment.amount_received ?? payment.amount_requested,
    });
  } else if (payment.status === "amount_mismatch") {
    if (!payment.amount_received) {
      Sentry.captureMessage("X-Hub payment amount_mismatch without a received amount", {
        level: "error",
        tags: { component: "xhub", reason: "amount_mismatch" },
        extra: { orderUuid, paymentId: payment.id },
      });
      await holdCapturedPaymentMismatch({
        provider: XHUB_PAYMENT_PROVIDER,
        orderUuid,
        chargeId: payment.id,
      });
      return;
    }
    await fulfillXhubPayment({
      orderUuid,
      paymentId: payment.id,
      amountRub: payment.amount_received,
    });
  } else if (["failed", "cancelled", "expired"].includes(payment.status)) {
    await failXhubPayment(orderUuid);
  } else if (payment.status === "refunded") {
    const refundedAmount = rubStringToKopecks(payment.amount_received ?? payment.amount_requested);
    if (refundedAmount !== null) {
      await markXhubRefunded({ orderUuid, paymentId: payment.id, refundedAmount });
    }
  }
}

export async function applyVerifiedTrybitInvoice(orderUuid: string, invoice: TrybitInvoiceStatus) {
  if (invoice.order_id !== orderUuid) throw new Error("Trybit invoice order mismatch");
  if (invoice.status === "paid" || invoice.status === "overpaid") {
    if (invoice.fiat_currency && invoice.fiat_currency.toUpperCase() !== "USD") {
      throw new Error("Trybit invoice currency mismatch");
    }
    const amount = invoice.amount_usd ?? (invoice.fiat_currency?.toUpperCase() === "USD" ? invoice.amount_in_fiat : undefined);
    if (amount === undefined || !Number.isFinite(amount) || amount <= 0) throw new Error("Trybit paid invoice missing USD amount");
    await fulfillTrybitPayment({ orderUuid, invoiceUuid: invoice.uuid, amountUsd: amount });
  } else if (invoice.status === "canceled") {
    await failTrybitPayment(orderUuid);
  }
}

/** Separate from supplier recovery: never require a callback to discover payment. */
export async function reconcilePendingPayments() {
  const providers = [paypalConfigured() ? "paypal" : null, trybitConfigured() ? "trybit" : null, xhubConfigured() ? "xhub" : null, unitpayConfigured() ? "unitpay" : null].filter((p): p is string => p !== null);
  if (!providers.length) return;
  const now = new Date();
  const orders = await db.order.findMany({
    where: {
      paymentProvider: { in: providers },
      paymentStatus: { in: ["pending", "failed"] },
      paymentChargeId: null,
      paymentNextCheckAt: { lte: now },
      // Do not query a provider for drafts that never attempted invoice creation.
      OR: [{ paymentInvoiceId: { not: null } }, { paymentInvoiceUrl: { not: null } }, { paymentInvoiceClaim: { not: null } }],
    },
    orderBy: [{ paymentNextCheckAt: "asc" }, { id: "asc" }],
    take: 25,
  });
  for (const order of orders) {
    // Rotate errors and unpaid invoices fairly; keep checking old invoices daily
    // rather than permanently losing payments after an arbitrary age cutoff.
    const interval = now.getTime() - order.createdAt.getTime() > 2 * 86_400_000 ? 86_400_000 : 5 * 60_000;
    // Prisma reads timestamps to the millisecond. A stored microsecond must still match,
    // while a next-check written minutes ahead falls outside this window.
    const dueAt = order.paymentNextCheckAt;
    const claimed = await db.order.updateMany({
      where: {
        id: order.id,
        paymentStatus: { in: ["pending", "failed"] },
        paymentNextCheckAt: { gte: dueAt, lt: new Date(dueAt.getTime() + 1) },
      },
      data: { paymentNextCheckAt: new Date(now.getTime() + interval) },
    });
    if (!claimed.count) continue;
    try {
      if (order.paymentProvider === "trybit") {
        const invoice = order.paymentInvoiceId
          ? await getTrybitInvoice(order.paymentInvoiceId)
          : await findTrybitInvoice(order.orderUuid, order.createdAt);
        if (!invoice) {
          if (unpaidTrybitExpired(order.createdAt, now)) await failTrybitPayment(order.orderUuid);
          continue;
        }
        if (invoice.order_id !== order.orderUuid) throw new Error("Trybit invoice order mismatch");
        if (order.paymentInvoiceId && normalizeTrybitInvoiceId(order.paymentInvoiceId) !== invoice.uuid) throw new Error("Trybit invoice ID mismatch");
        await db.order.updateMany({ where: { id: order.id, paymentInvoiceId: null }, data: { paymentInvoiceId: invoice.uuid } });
        await applyVerifiedTrybitInvoice(order.orderUuid, invoice);
        if (
          invoice.status !== "paid" &&
          invoice.status !== "overpaid" &&
          invoice.status !== "canceled" &&
          unpaidTrybitExpired(order.createdAt, now)
        ) {
          await failTrybitPayment(order.orderUuid);
        }
      } else if (order.paymentProvider === "paypal") {
        if (order.paymentInvoiceId) await reconcilePaypalOrder(order.paymentInvoiceId);
      } else if (order.paymentProvider === "unitpay") {
        if (!order.paymentInvoiceId) continue;
        const payment = await getUnitpayPayment(order.paymentInvoiceId);
        validateUnitpayPayment(payment, order);
        if (["success", "error_pay"].includes(payment.status) && Number(payment.isPreauth) === 0) {
          await fulfillUnitpayPayment({ orderUuid: order.orderUuid, paymentId: payment.paymentId, amount: unitpayAmountToMinor(payment.orderSum), currency: payment.orderCurrency });
        }
      } else {
        const payment = order.paymentInvoiceId
          ? await getXhubPayment(order.paymentInvoiceId)
          : await findXhubPayment(order.orderUuid, order.createdAt);
        if (!payment) continue;
        await applyVerifiedXhubPayment(order.orderUuid, payment);
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: "payment-reconciliation", provider: order.paymentProvider },
        extra: { orderUuid: order.orderUuid },
      });
    }
  }
}
