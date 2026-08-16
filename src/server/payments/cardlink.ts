import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { env } from "~/env";

const CARDLINK_API_BASE = "https://cardlink.link/api/v1";

export type CardlinkBill = {
  billId: string;
  linkPageUrl: string;
};

type CardlinkCreateResponse = {
  success?: boolean | string;
  link_page_url?: string;
  bill_id?: string;
  message?: string;
};

function signsEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function cardlinkConfigured() {
  return (
    typeof env.CARDLINK_API_TOKEN === "string" &&
    env.CARDLINK_API_TOKEN.length > 0 &&
    typeof env.CARDLINK_SHOP_ID === "string" &&
    env.CARDLINK_SHOP_ID.length > 0
  );
}

export function verifyCardlinkSign(input: {
  outSum: string;
  invId: string;
  signature: string;
}) {
  if (!cardlinkConfigured()) {
    return false;
  }
  const expected = createHash("md5")
    .update(`${input.outSum}:${input.invId}:${env.CARDLINK_API_TOKEN}`)
    .digest("hex")
    .toUpperCase();
  return signsEqual(expected, input.signature.toUpperCase());
}

export async function createCardlinkBill(input: {
  amount: string;
  orderId: string;
  description: string;
  name: string;
  currency: "USD" | "RUB";
  locale: "en" | "ru";
  successUrl: string;
  failUrl: string;
  returnUrl: string;
}): Promise<CardlinkBill> {
  if (!cardlinkConfigured()) {
    throw new Error("cardlink_not_configured");
  }

  const body = new URLSearchParams({
    amount: input.amount,
    shop_id: env.CARDLINK_SHOP_ID!,
    order_id: input.orderId,
    description: input.description,
    type: "normal",
    locale: input.locale,
    currency_in: input.currency,
    name: input.name,
    success_url: input.successUrl,
    fail_url: input.failUrl,
    return_url: input.returnUrl,
  });

  const response = await fetch(`${CARDLINK_API_BASE}/bill/create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CARDLINK_API_TOKEN}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = (await response.json()) as CardlinkCreateResponse;
  const ok = payload.success === true || payload.success === "true";
  if (!response.ok || !ok || !payload.link_page_url || !payload.bill_id) {
    throw new Error(
      `Cardlink bill/create failed: ${payload.message ?? response.statusText}`,
    );
  }

  return {
    billId: payload.bill_id,
    linkPageUrl: payload.link_page_url,
  };
}
