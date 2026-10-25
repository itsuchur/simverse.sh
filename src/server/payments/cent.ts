import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { env } from "~/env";

const CENT_API_BASE = "https://cent.app/api/v1";

export type CentBill = {
  billId: string;
  linkPageUrl: string;
};

type CentCreateResponse = {
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

function verifyCentMd5(payload: string, signature: string) {
  if (!centConfigured()) {
    return false;
  }
  const expected = createHash("md5")
    .update(`${payload}:${env.CENT_API_TOKEN}`)
    .digest("hex")
    .toUpperCase();
  return signsEqual(expected, signature.toUpperCase());
}

export function centConfigured() {
  return (
    typeof env.CENT_API_TOKEN === "string" &&
    env.CENT_API_TOKEN.length > 0 &&
    typeof env.CENT_SHOP_ID === "string" &&
    env.CENT_SHOP_ID.length > 0
  );
}

export function verifyCentSign(input: {
  outSum: string;
  invId: string;
  signature: string;
}) {
  return verifyCentMd5(`${input.outSum}:${input.invId}`, input.signature);
}

export function verifyCentRefundSign(input: {
  amount: string;
  currency: string;
  billId: string;
  paymentId: string;
  refundId: string;
  signature: string;
}) {
  return verifyCentMd5(
    `${input.amount}:${input.currency}:${input.billId}:${input.paymentId}:${input.refundId}`,
    input.signature,
  );
}

export function verifyCentChargebackSign(input: {
  billId: string;
  paymentId: string;
  chargebackId: string;
  signature: string;
}) {
  return verifyCentMd5(
    `${input.billId}:${input.paymentId}:${input.chargebackId}`,
    input.signature,
  );
}

export async function createCentBill(input: {
  amount: string;
  orderId: string;
  description: string;
  name: string;
  currency: "USD" | "RUB";
  locale: "en" | "ru";
  successUrl: string;
  failUrl: string;
  returnUrl: string;
}): Promise<CentBill> {
  if (!centConfigured()) {
    throw new Error("cent_not_configured");
  }

  const body = new URLSearchParams({
    amount: input.amount,
    shop_id: env.CENT_SHOP_ID!,
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

  const response = await fetch(`${CENT_API_BASE}/bill/create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CENT_API_TOKEN}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = (await response.json()) as CentCreateResponse;
  const ok = payload.success === true || payload.success === "true";
  if (!response.ok || !ok || !payload.link_page_url || !payload.bill_id) {
    throw new Error(
      `Cent bill/create failed: ${payload.message ?? response.statusText}`,
    );
  }

  return {
    billId: payload.bill_id,
    linkPageUrl: payload.link_page_url,
  };
}
