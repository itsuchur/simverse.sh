import "server-only";

import { z } from "zod";

import { withWebhookLogging } from "~/lib/webhook-logger";
import {
  failPlategaPayment,
  fulfillPlategaPayment,
  markPlategaChargeback,
} from "~/server/orders/fulfill";
import { verifyPlategaCallbackCredentials } from "~/server/payments/platega";

const callbackSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().finite().positive(),
  currency: z.string().min(1),
  status: z.enum(["CONFIRMED", "CANCELED", "CHARGEBACKED"]),
  paymentMethod: z.number().int().optional(),
  payload: z.string().uuid(),
});

export const handlePlategaWebhook = withWebhookLogging(
  "platega",
  async (request: Request, payload: unknown, _rawBody, persist) => {
    const merchantId = request.headers.get("x-merchantid") ?? "";
    const secret = request.headers.get("x-secret") ?? "";
    if (!verifyPlategaCallbackCredentials({ merchantId, secret })) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const unavailable = await persist();
    if (unavailable) return unavailable;

    const parsed = callbackSchema.safeParse(payload);
    if (!parsed.success) {
      return Response.json({ error: "Invalid body" }, { status: 400 });
    }

    const {
      id: transactionId,
      amount,
      currency,
      status,
      payload: orderUuid,
    } = parsed.data;

    if (status === "CONFIRMED") {
      await fulfillPlategaPayment({
        orderUuid,
        transactionId,
        amount,
        currency,
      });
    } else if (status === "CANCELED") {
      await failPlategaPayment(orderUuid);
    } else {
      await markPlategaChargeback({ orderUuid, transactionId });
    }

    return Response.json({ ok: true });
  },
);
