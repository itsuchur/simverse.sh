import "server-only";

import { z } from "zod";

import { withWebhookLogging } from "~/lib/webhook-logger";
import {
  failCryptomusPayment,
  fulfillCryptomusPayment,
} from "~/server/orders/fulfill";
import { verifyCryptomusSign } from "~/server/payments/cryptomus";

const PAID_STATUSES = new Set(["paid", "paid_over"]);
const FAILED_STATUSES = new Set(["fail", "cancel", "system_fail"]);

const webhookSchema = z.object({
  uuid: z.string().min(1),
  order_id: z.string().min(1),
  amount: z.string().min(1),
  status: z.string().min(1),
  sign: z.string().min(1),
});

export const handleCryptomusWebhook = withWebhookLogging(
  "cryptomus",
  async (_request: Request, payload: unknown) => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const record = payload as Record<string, unknown>;
    if (!verifyCryptomusSign(record)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = webhookSchema.safeParse(payload);
    if (!parsed.success) {
      return Response.json({ ok: true });
    }

    const { uuid, order_id: orderUuid, amount, status } = parsed.data;

    if (PAID_STATUSES.has(status)) {
      await fulfillCryptomusPayment({
        orderUuid,
        cryptomusUuid: uuid,
        amount,
      });
      return Response.json({ ok: true });
    }

    if (FAILED_STATUSES.has(status)) {
      await failCryptomusPayment(orderUuid);
    }

    return Response.json({ ok: true });
  },
);
