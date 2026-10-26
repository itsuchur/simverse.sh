import "server-only";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { withWebhookLogging } from "~/lib/webhook-logger";
import { applyVerifiedXhubPayment } from "~/server/orders/payment-reconciliation";
import { getXhubPayment, verifyXhubWebhookSignature } from "~/server/payments/xhub";
import { syncXhubRefund } from "~/server/orders/topup-refund";

const refundEventSchema = z.object({
  event: z.enum([
    "refund.completed",
    "refund.rejected",
    "refund.failed",
    "refund.reversed",
  ]),
  payment_id: z.string().min(1),
  refund_id: z.string().min(1),
});

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

export const handleXhubWebhook = withWebhookLogging(
  "xhub",
  async (request: Request, payload: unknown, rawBody: string, persist) => {
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

    const unavailable = await persist();
    if (unavailable) return unavailable;

    if (
      payload &&
      typeof payload === "object" &&
      "event" in payload &&
      typeof payload.event === "string" &&
      payload.event.startsWith("refund.")
    ) {
      const parsed = refundEventSchema.safeParse(payload);
      if (!parsed.success)
        return Response.json({ error: "Invalid body" }, { status: 400 });
      await syncXhubRefund({
        paymentId: parsed.data.payment_id,
        refundId: parsed.data.refund_id,
      });
      return Response.json({ ok: true });
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

    try {
      const payment = await getXhubPayment(parsed.data.payment_id);
      await applyVerifiedXhubPayment(parsed.data.external_id, payment);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: "xhub", reason: "payment_verification_failed" },
        extra: { orderUuid: parsed.data.external_id },
      });
      return Response.json(
        { error: "Payment verification unavailable" },
        { status: 503 },
      );
    }

    return Response.json({ ok: true });
  },
);
