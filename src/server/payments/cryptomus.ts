import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { env } from "~/env";

const CRYPTOMUS_API_BASE = "https://api.cryptomus.com/v1";

export type CryptomusInvoice = {
  uuid: string;
  url: string;
  payment_status?: string;
  is_final?: boolean;
};

type CryptomusCreateResponse = {
  state?: number;
  result?: CryptomusInvoice;
  message?: string;
};

function cryptomusJson(payload: unknown) {
  return JSON.stringify(payload).replaceAll("/", "\\/");
}

function cryptomusSign(json: string, apiKey: string) {
  const encoded = Buffer.from(json, "utf8").toString("base64");
  return createHash("md5")
    .update(encoded + apiKey)
    .digest("hex");
}

function signsEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function cryptomusConfigured() {
  return (
    typeof env.CRYPTOMUS_MERCHANT_ID === "string" &&
    env.CRYPTOMUS_MERCHANT_ID.length > 0 &&
    typeof env.CRYPTOMUS_API_KEY === "string" &&
    env.CRYPTOMUS_API_KEY.length > 0
  );
}

export function verifyCryptomusSign(payload: Record<string, unknown>) {
  if (!cryptomusConfigured()) {
    return false;
  }
  const sign = payload.sign;
  if (typeof sign !== "string" || sign.length === 0) {
    return false;
  }

  const unsigned: Record<string, unknown> = { ...payload };
  delete unsigned.sign;
  const json = cryptomusJson(unsigned);
  const expected = cryptomusSign(json, env.CRYPTOMUS_API_KEY!);
  return signsEqual(expected, sign);
}

export async function createCryptomusInvoice(input: {
  amount: string;
  orderId: string;
  urlCallback: string;
  urlSuccess: string;
  urlReturn: string;
  refresh?: boolean;
}): Promise<CryptomusInvoice> {
  if (!cryptomusConfigured()) {
    throw new Error("cryptomus_not_configured");
  }

  const payload: Record<string, unknown> = {
    amount: input.amount,
    currency: "USD",
    order_id: input.orderId,
    url_callback: input.urlCallback,
    url_success: input.urlSuccess,
    url_return: input.urlReturn,
  };
  if (input.refresh) {
    payload.is_refresh = true;
  }

  const json = cryptomusJson(payload);
  const response = await fetch(`${CRYPTOMUS_API_BASE}/payment`, {
    method: "POST",
    headers: {
      merchant: env.CRYPTOMUS_MERCHANT_ID!,
      sign: cryptomusSign(json, env.CRYPTOMUS_API_KEY!),
      "Content-Type": "application/json",
    },
    body: json,
  });

  const body = (await response.json()) as CryptomusCreateResponse;
  if (!response.ok || body.state !== 0 || !body.result?.url || !body.result.uuid) {
    throw new Error(
      `Cryptomus payment failed: ${body.message ?? response.statusText}`,
    );
  }

  return body.result;
}

export async function createOrRefreshCryptomusInvoice(
  input: Omit<Parameters<typeof createCryptomusInvoice>[0], "refresh">,
) {
  const invoice = await createCryptomusInvoice(input);
  const paid =
    invoice.payment_status === "paid" || invoice.payment_status === "paid_over";
  if (invoice.is_final && !paid) {
    return createCryptomusInvoice({ ...input, refresh: true });
  }
  return invoice;
}
