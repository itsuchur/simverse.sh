import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "~/env";

const XHUB_API_BASE = "https://api.x-hub.online/api/v1";
const WEBHOOK_MAX_AGE_MS = 5 * 60_000;

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
  });

  const payload = (await response
    .json()
    .catch(() => null)) as XhubCreateResponse | null;
  if (!response.ok || !payload?.id || !payload.payment_url) {
    const detail =
      payload?.error?.message ??
      payload?.error?.code ??
      response.statusText;
    throw new Error(`X-Hub payment failed: ${detail}`);
  }

  return {
    id: payload.id,
    paymentUrl: payload.payment_url,
  };
}
