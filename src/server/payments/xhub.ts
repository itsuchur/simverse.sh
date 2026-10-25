import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "~/env";
import { z } from "zod";

const XHUB_API_BASE = "https://api.x-hub.online/api/v1";
const WEBHOOK_MAX_AGE_MS = 5 * 60_000;

const refundSchema = z.object({
  id: z.string().min(1),
  payment_id: z.string().min(1),
  amount_rub: z.string().regex(/^\d+\.\d{2}$/),
  status: z.enum([
    "requested",
    "executing",
    "completed",
    "rejected",
    "cancelled",
    "failed",
    "reversed",
  ]),
});

export type XhubRefund = z.infer<typeof refundSchema>;

async function xhubRefundRequest(
  path: string,
  init?: RequestInit,
): Promise<XhubRefund> {
  if (!xhubConfigured()) throw new Error("xhub_not_configured");
  const response = await fetch(`${XHUB_API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": env.XHUB_API_KEY!,
      "X-Api-Secret": env.XHUB_API_SECRET!,
      ...init?.headers,
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    // Do not log response bodies: the status and operation identify the failure.
    throw new Error(`X-Hub refund request failed: HTTP ${response.status}`);
  }
  return refundSchema.parse(await response.json());
}

/** Full remaining refund. Reuse the persisted refund UUID on every retry. */
export function createXhubRefund(input: {
  paymentId: string;
  orderUuid: string;
  idempotencyKey: string;
  reason: string;
}): Promise<XhubRefund> {
  return xhubRefundRequest("/refunds", {
    method: "POST",
    headers: { "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify({
      payment_id: input.paymentId,
      external_id: input.orderUuid,
      reason: input.reason,
    }),
  });
}

export function getXhubRefund(refundId: string): Promise<XhubRefund> {
  return xhubRefundRequest(`/refunds/${encodeURIComponent(refundId)}`);
}

export type XhubPaymentMethod = "sbp" | "card";

export type XhubPayment = {
  id: string;
  paymentUrl: string;
};

type XhubCreateResponse = {
  id?: string;
  payment_url?: string;
  status?: string;
  error?: {
    code?: string;
    message?: string;
  };
};

function valuesEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function formatXhubAmountRub(amountRub: number) {
  if (!Number.isFinite(amountRub) || amountRub <= 0) {
    throw new Error("invalid_xhub_amount");
  }
  return amountRub.toFixed(2);
}

export function xhubConfigured() {
  return (
    typeof env.XHUB_API_KEY === "string" &&
    env.XHUB_API_KEY.length > 0 &&
    typeof env.XHUB_API_SECRET === "string" &&
    env.XHUB_API_SECRET.length > 0 &&
    typeof env.XHUB_WEBHOOK_SECRET === "string" &&
    env.XHUB_WEBHOOK_SECRET.length > 0
  );
}

export function verifyXhubWebhookSignature(input: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  nowMs?: number;
}) {
  if (!xhubConfigured()) {
    return false;
  }
  if (!input.signature || !input.timestamp) {
    return false;
  }

  const timestampMs = Date.parse(input.timestamp);
  if (!Number.isFinite(timestampMs)) {
    return false;
  }
  const nowMs = input.nowMs ?? Date.now();
  if (Math.abs(nowMs - timestampMs) > WEBHOOK_MAX_AGE_MS) {
    return false;
  }

  const expected =
    "sha256=" +
    createHmac("sha256", env.XHUB_WEBHOOK_SECRET!)
      .update(`${input.timestamp}.${input.rawBody}`)
      .digest("hex");

  return valuesEqual(input.signature, expected);
}

export async function createXhubPayment(input: {
  amountRub: number;
  orderUuid: string;
  paymentMethod: XhubPaymentMethod;
  description: string;
  successUrl: string;
  clientIp?: string | null;
}): Promise<XhubPayment> {
  if (!xhubConfigured()) {
    throw new Error("xhub_not_configured");
  }

  const body: Record<string, unknown> = {
    amount_rub: formatXhubAmountRub(input.amountRub),
    external_id: input.orderUuid,
    payment_method: input.paymentMethod,
    description: input.description,
    success_url: input.successUrl,
  };
  if (input.clientIp) {
    body.client_info = { ip: input.clientIp };
  }

  const response = await fetch(`${XHUB_API_BASE}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": env.XHUB_API_KEY!,
      "X-Api-Secret": env.XHUB_API_SECRET!,
      "Idempotency-Key": input.orderUuid,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });

  const payload = (await response
    .json()
    .catch(() => null)) as XhubCreateResponse | null;
  if (!response.ok || !payload?.id || !payload.payment_url) {
    const detail =
      payload?.error?.message ?? payload?.error?.code ?? response.statusText;
    throw new Error(`X-Hub payment failed: ${detail}`);
  }

  return {
    id: payload.id,
    paymentUrl: payload.payment_url,
  };
}

const paymentStateSchema = z.object({
  id: z.string().min(1),
  external_id: z.string().nullable(),
  status: z.string(),
  amount_requested: z.string(),
  amount_received: z.string().nullable(),
});

export type XhubPaymentState = z.infer<typeof paymentStateSchema>;

async function xhubPaymentQuery(path: string): Promise<unknown> {
  if (!xhubConfigured()) throw new Error("xhub_not_configured");
  const response = await fetch(`${XHUB_API_BASE}${path}`, {
    headers: { "X-Api-Key": env.XHUB_API_KEY!, "X-Api-Secret": env.XHUB_API_SECRET! },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`X-Hub payment lookup failed: HTTP ${response.status}`);
  return response.json();
}

export async function getXhubPayment(id: string): Promise<XhubPaymentState> {
  const payment = paymentStateSchema.parse(await xhubPaymentQuery(`/payments/${encodeURIComponent(id)}`));
  if (payment.id.replace(/^pay_/, "") !== id.replace(/^pay_/, "")) throw new Error("X-Hub payment ID mismatch");
  return payment;
}

export async function findXhubPayment(orderUuid: string, createdAt: Date) {
  for (let page = 1; page <= 100; page++) {
    const params = new URLSearchParams({
      from: new Date(createdAt.getTime() - 86_400_000).toISOString(),
      to: new Date(createdAt.getTime() + 86_400_000).toISOString(),
      per_page: "100", page: String(page),
    });
    const response = z.object({
      data: z.array(z.object({ id: z.string(), external_id: z.string().nullable() })),
      pagination: z.object({ total_pages: z.number().int().nonnegative() }),
    }).parse(await xhubPaymentQuery(`/payments?${params}`));
    const matches = response.data.filter((row) => row.external_id === orderUuid);
    if (matches.length > 1) throw new Error("Multiple X-Hub payments for one order; manual reconciliation required");
    if (matches[0]) return getXhubPayment(matches[0].id);
    if (page >= response.pagination.total_pages) return null;
  }
  throw new Error("X-Hub payment discovery exceeded pagination limit");
}
