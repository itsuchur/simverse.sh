import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "~/env";
import { z } from "zod";

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
    signal: AbortSignal.timeout(10_000),
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

const invoiceStatusSchema = z.object({
  uuid: z.string().min(1),
  order_id: z.string().nullable(),
  status: z.string(),
  invoice_status: z.string().optional(),
  amount_usd: z.coerce.number().finite().nonnegative().optional(),
  amount_in_fiat: z.coerce.number().finite().nonnegative().optional(),
  fiat_currency: z.string().optional(),
});

export type TrybitInvoiceStatus = z.infer<typeof invoiceStatusSchema>;

async function queryTrybitInvoices(path: string, body: unknown) {
  if (!trybitConfigured()) throw new Error("trybit_not_configured");
  const response = await fetch(`${TRYBIT_API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Token ${env.TRYBIT_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Trybit invoice lookup failed: HTTP ${response.status}`);
  return z.object({
    status: z.literal("success"),
    result: z.array(invoiceStatusSchema),
    all_count: z.number().int().nonnegative().optional(),
  }).parse(await response.json());
}

export function normalizeTrybitInvoiceId(id: string) {
  return id.startsWith("INV-") ? id : `INV-${id}`;
}

export async function getTrybitInvoice(id: string): Promise<TrybitInvoiceStatus> {
  const uuid = normalizeTrybitInvoiceId(id);
  const response = await queryTrybitInvoices("/invoice/merchant/info", { uuids: [uuid] });
  const invoice = response.result.find((row) => row.uuid === uuid);
  if (!invoice) throw new Error("Trybit invoice lookup returned no matching invoice");
  return invoice;
}

/** Recover provider IDs lost during invoice creation, including pre-migration drafts. */
export async function findTrybitInvoice(orderUuid: string, createdAt: Date) {
  const day = (offset: number) => {
    const d = new Date(createdAt.getTime() + offset * 86_400_000);
    return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
  };
  for (let offset = 0; offset < 10_000; offset += 100) {
    const response = await queryTrybitInvoices("/invoice/merchant/list", {
      start: day(-1), end: day(1), offset, limit: 100,
    });
    const matches = response.result.filter((row) => row.order_id === orderUuid);
    if (matches.length > 1) throw new Error("Multiple Trybit invoices for one order; manual reconciliation required");
    if (matches[0]) return matches[0];
    if (response.result.length < 100 || (response.all_count !== undefined && offset + 100 >= response.all_count)) return null;
  }
  throw new Error("Trybit invoice discovery exceeded pagination limit");
}
