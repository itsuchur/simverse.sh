import "server-only";

import { z } from "zod";

import { withWebhookLogging } from "~/lib/webhook-logger";
import {
  failTrybitPayment,
  fulfillTrybitPayment,
} from "~/server/orders/fulfill";
import { verifyTrybitPostbackToken } from "~/server/payments/trybit";

const PAID_INVOICE_STATUSES = new Set(["paid", "overpaid"]);

const invoiceInfoSchema = z
  .object({
    uuid: z.string().min(1).optional(),
    status: z.string().optional(),
    invoice_status: z.string().optional(),
    amount_usd: z.coerce.number().optional(),
    amount_in_fiat: z.coerce.number().optional(),
    fiat_currency: z.string().optional(),
  })
  .optional();

const postbackSchema = z.object({
  status: z.string().optional(),
  invoice_id: z.string().min(1),
  order_id: z.string().min(1),
  token: z.string().min(1),
  invoice_info: invoiceInfoSchema,
});

function invoiceUuid(invoiceId: string, uuid: string | undefined) {
  if (uuid && uuid.length > 0) {
    return uuid;
  }
  return invoiceId.startsWith("INV-") ? invoiceId : `INV-${invoiceId}`;
}

function usdAmount(info: z.infer<typeof invoiceInfoSchema>) {
  if (!info) {
    return null;
  }
  if (typeof info.amount_usd === "number") {
    return info.amount_usd;
  }
  const fiat = info.fiat_currency?.toUpperCase();
  if (typeof info.amount_in_fiat === "number" && fiat === "USD") {
    return info.amount_in_fiat;
  }
  return null;
}

export const handleTrybitWebhook = withWebhookLogging(
  "trybit",
  async (_request: Request, payload: unknown) => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = postbackSchema.safeParse(payload);
    if (!parsed.success) {
      return Response.json({ message: "Postback received" });
    }

    const { invoice_id, order_id: orderUuid, token, invoice_info } = parsed.data;

    if (!verifyTrybitPostbackToken(token)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invoiceStatus = invoice_info?.status;
    const invoiceResult = invoice_info?.invoice_status;
    const paid =
      (typeof invoiceStatus === "string" &&
        PAID_INVOICE_STATUSES.has(invoiceStatus)) ||
      invoiceResult === "success";

    if (paid) {
      const amount = usdAmount(invoice_info);
      if (amount === null) {
        return Response.json({ message: "Postback received" });
      }
      await fulfillTrybitPayment({
        orderUuid,
        invoiceUuid: invoiceUuid(invoice_id, invoice_info?.uuid),
        amountUsd: amount,
      });
      return Response.json({ message: "Postback received" });
    }

    if (invoiceStatus === "canceled") {
      await failTrybitPayment(orderUuid);
    }

    return Response.json({ message: "Postback received" });
  },
);
