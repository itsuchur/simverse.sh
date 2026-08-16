import "server-only";

import { z } from "zod";

import { withWebhookLogging } from "~/lib/webhook-logger";
import {
  failCardlinkPayment,
  fulfillCardlinkPayment,
} from "~/server/orders/fulfill";
import { verifyCardlinkSign } from "~/server/payments/cardlink";

const PAID_STATUSES = new Set(["SUCCESS", "OVERPAID"]);
const FAILED_STATUSES = new Set(["FAIL"]);

const postbackSchema = z.object({
  InvId: z.string().min(1),
  OutSum: z.string().min(1),
  TrsId: z.string().min(1),
  Status: z.string().min(1),
  CurrencyIn: z.string().min(1),
  SignatureValue: z.string().min(1),
});

export const handleCardlinkWebhook = withWebhookLogging(
  "cardlink",
  async (_request: Request, payload: unknown) => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return Response.json({ error: "Invalid body" }, { status: 400 });
    }

    const parsed = postbackSchema.safeParse(payload);
    if (!parsed.success) {
      return Response.json({ ok: true });
    }

    const {
      InvId: orderUuid,
      OutSum: amount,
      TrsId: billId,
      Status: status,
      CurrencyIn: currency,
      SignatureValue: signature,
    } = parsed.data;

    if (!verifyCardlinkSign({ outSum: amount, invId: orderUuid, signature })) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (PAID_STATUSES.has(status)) {
      await fulfillCardlinkPayment({
        orderUuid,
        billId,
        amount,
        currency,
      });
      return Response.json({ ok: true });
    }

    if (FAILED_STATUSES.has(status)) {
      await failCardlinkPayment(orderUuid);
    }

    return Response.json({ ok: true });
  },
);
