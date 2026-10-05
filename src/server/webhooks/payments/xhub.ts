import "server-only";

import { z } from "zod";

import { withWebhookLogging } from "~/lib/webhook-logger";
import {
  failXhubPayment,
  fulfillXhubPayment,
  markXhubRefunded,
} from "~/server/orders/fulfill";
import { verifyXhubWebhookSignature } from "~/server/payments/xhub";

const paymentStatusChangedSchema = z.object({
  event: z.literal("payment.status_changed"),
  payment_id: z.string().min(1),
  external_id: z.string().uuid(),
  status: z.enum([
    "pending",
    "processing",
    "paid",
    "settled",
    "amount_mismatch",
    "expired",
    "cancelled",
    "failed",
    "refunded",
  ]),
  amount_rub: z.string().min(1),
  actual_amount_rub: z.string().nullable().optional(),
  payment_method: z.enum(["sbp", "card", "recurring"]).optional(),
});

function rubStringToKopecks(amount: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return null;
  }
  return BigInt(Math.round(value * 100));
}

export const handleXhubWebhook = withWebhookLogging(
  "xhub",
  async (request: Request, payload: unknown, rawBody: string) => {
    const signature = request.headers.get("x-webhook-signature");
    const timestamp = request.headers.get("x-webhook-timestamp");
    if (
      !verifyXhubWebhookSignature({
        rawBody,
        signature,
        timestamp,
      })
    ) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      !("event" in payload) ||
      payload.event !== "payment.status_changed"
    ) {
      return Response.json({ ok: true });
    }

    const parsed = paymentStatusChangedSchema.safeParse(payload);
    if (!parsed.success) {
      return Response.json({ error: "Invalid body" }, { status: 400 });
    }

    const {
      payment_id: paymentId,
      external_id: orderUuid,
      status,
      amount_rub: amountRub,
      actual_amount_rub: actualAmountRub,
    } = parsed.data;

    if (status === "paid") {
      await fulfillXhubPayment({
        orderUuid,
        paymentId,
        amountRub: actualAmountRub ?? amountRub,
      });
    } else if (status === "failed" || status === "cancelled") {
      await failXhubPayment(orderUuid);
    } else if (status === "refunded") {
      const refundedAmount = rubStringToKopecks(actualAmountRub ?? amountRub);
      if (refundedAmount !== null) {
        await markXhubRefunded({
          orderUuid,
          paymentId,
          refundedAmount,
        });
      }
    }

    return Response.json({ ok: true });
  },
);
