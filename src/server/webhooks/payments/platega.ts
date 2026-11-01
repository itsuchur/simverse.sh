import "server-only";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { db } from "~/server/db";
import { PLATEGA_PAYMENT_PROVIDER } from "~/lib/order-status";

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
  status: z.enum(["CONFIRMED", "CANCELED", "CHARGEBACKED", "DISPUTED"]),
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
    } else if (status === "DISPUTED") {
      // A dispute reserves merchant funds but is not a failed payment or chargeback.
      // Keep fulfillment idempotent when Platega repeats CONFIRMED after resolution.
      const order = await db.order.findUnique({ where: { orderUuid } });
      if (
        order?.paymentProvider === PLATEGA_PAYMENT_PROVIDER &&
        order.paymentChargeId === transactionId
      ) {
        Sentry.captureMessage("Platega payment disputed", {
          level: "warning",
          tags: { component: "platega", reason: "payment_disputed" },
          extra: { orderUuid, transactionId },
        });
      }
    } else {
      await markPlategaChargeback({ orderUuid, transactionId });
    }

    return Response.json({ ok: true });
  },
);
