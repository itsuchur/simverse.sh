import "server-only";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";

import { withWebhookLogging } from "~/lib/webhook-logger";
import {
  getTrybitInvoice,
  verifyTrybitPostbackToken,
} from "~/server/payments/trybit";
import { applyVerifiedTrybitInvoice } from "~/server/orders/payment-reconciliation";

const postbackSchema = z.object({
  status: z.string().optional(),
  invoice_id: z.string().min(1),
  order_id: z.string().min(1),
  token: z.string().min(1),
  invoice_info: z.unknown().optional(),
});

export const handleTrybitWebhook = withWebhookLogging(
  "trybit",
  async (_request: Request, payload: unknown, _rawBody, persist) => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = postbackSchema.safeParse(payload);
    if (!parsed.success) {
      return Response.json({ error: "Invalid postback" }, { status: 400 });
    }

    const { invoice_id, order_id: orderUuid, token } = parsed.data;

    if (!verifyTrybitPostbackToken(token)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const unavailable = await persist();
    if (unavailable) return unavailable;

    // The JWT authenticates its own claims, not the surrounding JSON/form.
    // Verify status, amount and order ownership through the merchant API.
    try {
      const invoice = await getTrybitInvoice(invoice_id);
      await applyVerifiedTrybitInvoice(orderUuid, invoice);
      return Response.json({ message: "Postback received" });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: "trybit", reason: "invoice_verification_failed" },
        extra: { orderUuid },
      });
      return Response.json(
        { error: "Invoice verification unavailable" },
        { status: 503 },
      );
    }
  },
);
