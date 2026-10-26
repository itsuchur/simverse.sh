import "server-only";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { env } from "~/env";
import { UNITPAY_PAYMENT_PROVIDER, paymentStatus } from "~/lib/order-status";
import {
  redactWebhookHeaders,
  redactWebhookValue,
} from "~/lib/webhook-redaction";
import { db } from "~/server/db";
import {
  failUnitpayPayment,
  fulfillUnitpayPayment,
} from "~/server/orders/fulfill";
import {
  unitpayAmountToMinor,
  verifyUnitpaySignature,
} from "~/server/payments/unitpay";

// CF-Connecting-IP is overwritten by Cloudflare. Do not fall back to client-supplied X-Forwarded-For.
// The ingress must restrict origin access to Cloudflare and preserve this header.
const UNITPAY_IPS = new Set([
  "31.186.100.49",
  "51.250.20.9",
  "217.198.170.141",
]);
const schema = z.object({
  account: z.string().uuid(),
  projectId: z.string().regex(/^\d+$/),
  unitpayId: z.string().regex(/^\d+$/),
  orderSum: z.string(),
  orderCurrency: z.string(),
  test: z.literal("0"),
});

function error(message: string, status = 200) {
  return Response.json(
    { error: { message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function handleUnitpayWebhook(request: Request) {
  if (!UNITPAY_IPS.has(request.headers.get("cf-connecting-ip")?.trim() ?? ""))
    return error("Unauthorized", 403);
  const query = new URL(request.url).searchParams;
  const method = query.get("method") ?? "";
  const params: Record<string, string> = {};
  for (const [key, value] of query) {
    if (query.getAll(key).length !== 1) return error("Duplicate parameter");
    const match = /^params\[([^\[\]]+)\]$/.exec(key);
    if (match) params[match[1]!] = value;
    else if (key !== "method") return error("Invalid parameter");
  }
  if (!verifyUnitpaySignature(method, params))
    return error("Unauthorized", 401);
  if (!["check", "pay", "error", "preauth"].includes(method))
    return error("Unsupported method");
  const parsed = schema.safeParse(params);
  if (!parsed.success || parsed.data.projectId !== env.UNITPAY_PROJECT_ID)
    return error("Invalid payment");
  try {
    const payload = parsed.data;
    const amount = unitpayAmountToMinor(payload.orderSum);
    await db.webhookLog.create({
      data: {
        source: "unitpay",
        headers: redactWebhookHeaders(request.headers),
        payload: {
          method,
          params: redactWebhookValue(params) as Record<string, string>,
        },
      },
    });
    const order = await db.order.findUnique({
      where: { orderUuid: payload.account },
    });
    if (
      order?.paymentProvider !== UNITPAY_PAYMENT_PROVIDER ||
      amount <= 0n ||
      amount !== order.priceAmount ||
      payload.orderCurrency !== order.currency ||
      (order.paymentInvoiceId &&
        order.paymentInvoiceId !== payload.unitpayId) ||
      (order.paymentChargeId && order.paymentChargeId !== payload.unitpayId)
    )
      return error("Payment does not match order");
    if (
      method === "check" &&
      order.paymentStatus !== paymentStatus.pending &&
      order.paymentStatus !== paymentStatus.failed
    )
      return error("Order is already paid or closed");
    if (method === "pay") {
      await fulfillUnitpayPayment({
        orderUuid: order.orderUuid,
        paymentId: payload.unitpayId,
        amount,
        currency: payload.orderCurrency,
      });
    } else if (method === "error") {
      // A later signed PAY can revive this failed draft.
      await failUnitpayPayment(order.orderUuid);
    }
    return Response.json(
      { result: { message: "OK" } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (cause) {
    Sentry.captureException(cause, {
      tags: { component: "unitpay", reason: "callback_failed" },
    });
    return error("Unable to process payment", 503);
  }
}
