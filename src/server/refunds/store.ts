import "server-only";
import type { Order, Prisma } from "@prisma/client";
import { db } from "~/server/db";
import {
  orderStatus,
  paymentStatus,
  CARDLINK_PAYMENT_PROVIDER,
  CENT_PAYMENT_PROVIDER,
} from "~/lib/order-status";
import { refundStatus } from "~/lib/refund-status";

const INVOICE_HOST_BY_PROVIDER: Record<string, string> = {
  [CARDLINK_PAYMENT_PROVIDER]: "cardlink.link",
  [CENT_PAYMENT_PROVIDER]: "cent.app",
};

export type RefundOrder = Pick<
  Order,
  | "id"
  | "orderUuid"
  | "paymentProvider"
  | "paymentChargeId"
  | "priceAmount"
  | "currency"
  | "topupOfOrderId"
>;
export type RefundSource = "dashboard" | "automatic" | "provider";

export async function ensureRefund(
  order: RefundOrder,
  input: { reason: string; source: RefundSource; requestedById?: string },
  client: Pick<Prisma.TransactionClient, "refund"> = db,
) {
  // A nonempty no-op update lets Prisma use PostgreSQL ON CONFLICT rather
  // than a racy client-side read/create for concurrent first requests.
  return client.refund.upsert({
    where: { orderId: order.id },
    update: { orderId: order.id },
    create: {
      orderId: order.id,
      provider: order.paymentProvider,
      providerPaymentId: order.paymentChargeId,
      amount: order.priceAmount,
      currency: order.currency,
      reason: input.reason,
      source: input.source,
      requestedById: input.requestedById,
    },
  });
}

/** Bind provider confirmations to the stored payment, not only a callback's merchant order UUID. */
export async function recordCompletedRefund(input: {
  orderUuid: string;
  provider: string;
  paymentId: string;
  refundId: string | null;
  amount: bigint;
  currency?: string;
  unmanagedOnly?: boolean;
}) {
  return db.$transaction(async (tx) => {
    const found = await tx.order.findUnique({
      where: { orderUuid: input.orderUuid },
    });
    if (!found) return;
    // Serialize all refund transitions on the order before touching Refund.
    const order = await tx.order.update({
      where: { id: found.id },
      data: { id: found.id },
    });
    if (
      order.paymentProvider !== input.provider ||
      input.amount <= 0n ||
      input.amount > order.priceAmount ||
      (input.currency && input.currency.toUpperCase() !== order.currency) ||
      order.paymentStatus === paymentStatus.chargeback
    )
      return;
    if (order.paymentChargeId && order.paymentChargeId !== input.paymentId)
      return;
    const invoiceHost = INVOICE_HOST_BY_PROVIDER[input.provider];
    if (!order.paymentChargeId && invoiceHost) {
      // A refund may precede the payment notification. Cardlink/Cent do not
      // sign InvId, so bind it to the bill in our server-created invoice URL.
      try {
        const invoice = new URL(order.paymentInvoiceUrl ?? "");
        if (
          invoice.hostname !== invoiceHost ||
          invoice.pathname.split("/").pop() !== input.paymentId
        )
          return;
      } catch {
        return;
      }
    }
    const existing = await tx.refund.findUnique({
      where: { orderId: order.id },
    });
    if (input.unmanagedOnly && existing && existing.source !== "provider")
      return;
    if (
      existing?.providerRefundId &&
      existing.providerRefundId !== input.refundId
    )
      return;
    if (existing && existing.amount !== input.amount) return;
    const refund =
      existing ??
      (await ensureRefund(
        order,
        { source: "provider", reason: "Refund reported by payment provider" },
        tx,
      ));
    if (refund.providerRefundId && refund.providerRefundId !== input.refundId)
      return;
    await tx.refund.update({
      where: { id: refund.id },
      data: {
        amount: input.amount,
        providerPaymentId: input.paymentId,
        providerRefundId: input.refundId,
        providerStatus: "completed",
        status: refundStatus.completed,
        completedAt: refund.completedAt ?? new Date(),
        failureCode: null,
      },
    });
    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: paymentStatus.refunded,
        status: orderStatus.refunded,
        refundedAmount: input.amount,
      },
    });
  });
}
