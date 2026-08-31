import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "~/env";

const TRYBIT_API_BASE = "https://api.trybit.com/v2";

export type TrybitInvoice = {
  uuid: string;
  link: string;
};

type TrybitCreateResponse = {
  status?: string;
  result?: {
    uuid?: string;
    link?: string;
  };
};

function signsEqual(left: Buffer, right: Buffer) {
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

function base64UrlDecode(input: string) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + "=".repeat(padLength), "base64");
}

export function trybitConfigured() {
  return (
    typeof env.TRYBIT_API_KEY === "string" &&
    env.TRYBIT_API_KEY.length > 0 &&
    typeof env.TRYBIT_SHOP_ID === "string" &&
    env.TRYBIT_SHOP_ID.length > 0 &&
    typeof env.TRYBIT_SECRET_KEY === "string" &&
    env.TRYBIT_SECRET_KEY.length > 0
  );
}

export function verifyTrybitPostbackToken(token: string) {
  if (!trybitConfigured()) {
    return false;
  }
  if (typeof token !== "string" || token.length === 0) {
    return false;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return false;
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  if (!headerB64 || !payloadB64 || !signatureB64) {
    return false;
  }

  let header: { alg?: unknown };
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString("utf8")) as {
      alg?: unknown;
    };
  } catch {
    return false;
  }
  if (header.alg !== "HS256") {
    return false;
  }

  const expected = createHmac("sha256", env.TRYBIT_SECRET_KEY!)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const actual = base64UrlDecode(signatureB64);
  if (!signsEqual(expected, actual)) {
    return false;
  }

  try {
    const payload = JSON.parse(
      base64UrlDecode(payloadB64).toString("utf8"),
    ) as {
      exp?: unknown;
      nbf?: unknown;
    };
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.nbf === "number" && now < payload.nbf) {
      return false;
    }
    if (typeof payload.exp === "number" && now >= payload.exp) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

export async function createTrybitInvoice(input: {
  amount: number;
  orderId: string;
}): Promise<TrybitInvoice> {
  if (!trybitConfigured()) {
    throw new Error("trybit_not_configured");
  }

  const response = await fetch(`${TRYBIT_API_BASE}/invoice/create`, {
    method: "POST",
    headers: {
      Authorization: `Token ${env.TRYBIT_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      shop_id: env.TRYBIT_SHOP_ID,
      amount: input.amount,
      currency: "USD",
      order_id: input.orderId,
    }),
  });

  const body = (await response.json()) as TrybitCreateResponse;
  if (
    !response.ok ||
    body.status !== "success" ||
    !body.result?.uuid ||
    !body.result.link
  ) {
    throw new Error(
      `Trybit payment failed: ${response.status} ${response.statusText}`,
    );
  }

  return { uuid: body.result.uuid, link: body.result.link };
}
