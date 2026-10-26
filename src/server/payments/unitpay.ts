import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "~/env";

const API = "https://unitpay.money/api";
const paymentIdSchema = z
  .union([z.string().regex(/^\d+$/), z.number().int().positive().safe()])
  .transform(String);
const paymentSchema = z.object({
  paymentId: paymentIdSchema,
  projectId: paymentIdSchema,
  account: z.string(),
  orderSum: z.string(),
  orderCurrency: z.string(),
  status: z.enum([
    "success",
    "wait",
    "error",
    "error_pay",
    "error_check",
    "refund",
    "secure",
  ]),
  isPreauth: z.union([z.number(), z.string()]),
  availableForRefund: z.string(),
  refunds: z.array(z.unknown()),
});
export type UnitpayPayment = z.infer<typeof paymentSchema>;

export function unitpayConfigured() {
  return Boolean(env.UNITPAY_PROJECT_ID && env.UNITPAY_SECRET_KEY);
}

export function unitpayAmountToMinor(value: string): bigint {
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error("Invalid Unitpay amount");
  const [major, minor = ""] = value.split(".");
  return BigInt(major!) * 100n + BigInt(minor.padEnd(2, "0"));
}

export function verifyUnitpaySignature(
  method: string,
  params: Record<string, string>,
) {
  if (!unitpayConfigured() || !/^[a-f0-9]{64}$/i.test(params.signature ?? ""))
    return false;
  const values = Object.keys(params)
    .filter((key) => key !== "signature")
    .sort()
    .map((key) => params[key]!);
  const expected = createHash("sha256")
    .update([method, ...values, env.UNITPAY_SECRET_KEY!].join("{up}"))
    .digest();
  return timingSafeEqual(expected, Buffer.from(params.signature!, "hex"));
}

async function unitpayRequest(
  method: string,
  params: Record<string, string>,
): Promise<unknown> {
  if (!unitpayConfigured()) throw new Error("unitpay_not_configured");
  const url = new URL(API);
  url.search = new URLSearchParams({
    method,
    ...params,
    secretKey: env.UNITPAY_SECRET_KEY!,
  }).toString();
  // Unitpay requires credentials in the query string. Never report this URL or raw fetch errors.
  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error(`Unitpay ${method} outcome unknown`);
  }
  const payload = (await response.json().catch(() => null)) as {
    result?: unknown;
    error?: unknown;
  } | null;
  if (!response.ok || !payload?.result || payload.error)
    throw new Error(`Unitpay ${method} failed`);
  return payload.result;
}

export async function createUnitpayPayment(input: {
  amount: string;
  orderUuid: string;
  description: string;
  currency: "RUB" | "USD";
  locale: "ru" | "en";
  resultUrl: string;
  backUrl: string;
}) {
  if (input.resultUrl.length + input.orderUuid.length > 225)
    throw new Error("Unitpay return URL too long");
  const result = await unitpayRequest("initPayment", {
    projectId: env.UNITPAY_PROJECT_ID!,
    paymentType: "card",
    sum: input.amount,
    account: input.orderUuid,
    desc: input.description,
    currency: input.currency,
    locale: input.locale,
    resultUrl: input.resultUrl,
    backUrl: input.backUrl,
    hideOtherMethods: "true",
  });
  const parsed = z
    .object({
      type: z.literal("redirect"),
      paymentId: paymentIdSchema,
      redirectUrl: z.string().url(),
    })
    .parse(result);
  const url = new URL(parsed.redirectUrl);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "unitpay.money" ||
    url.username ||
    url.password
  )
    throw new Error("Invalid Unitpay redirect URL");
  return { id: parsed.paymentId, url: parsed.redirectUrl };
}

export async function getUnitpayPayment(paymentId: string) {
  return paymentSchema.parse(await unitpayRequest("getPayment", { paymentId }));
}

export async function refundUnitpayPayment(paymentId: string) {
  // Omit sum: Unitpay permits only one refund per payment. Always request a full refund.
  z.object({ message: z.string() }).parse(
    await unitpayRequest("refundPayment", { paymentId }),
  );
}

export function validateUnitpayPayment(
  payment: UnitpayPayment,
  order: {
    orderUuid: string;
    paymentInvoiceId: string | null;
    paymentChargeId?: string | null;
    priceAmount: bigint;
    currency: string;
  },
) {
  if (
    payment.projectId !== env.UNITPAY_PROJECT_ID ||
    payment.account !== order.orderUuid ||
    payment.paymentId !== (order.paymentChargeId ?? order.paymentInvoiceId) ||
    payment.orderCurrency !== order.currency ||
    unitpayAmountToMinor(payment.orderSum) !== order.priceAmount
  ) {
    throw new Error("Unitpay payment does not match order");
  }
}
