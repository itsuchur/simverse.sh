import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { parse } from "lossless-json";
import { alpha2ToNumeric } from "i18n-iso-countries";
import { type CodapayCountry } from "~/lib/codapay-markets";
import { z } from "zod";
import { env } from "~/env";
import { apiPublicUrl } from "~/server/urls";

export function codapayConfigured() {
  return Boolean(env.CODAPAY_API_KEY && env.CODAPAY_PROJECT_ID);
}

function host() {
  return env.CODAPAY_ENVIRONMENT === "production"
    ? "airtime.codapayments.com"
    : "sandbox.codapayments.com";
}

async function call(endpoint: string, body: unknown) {
  if (!codapayConfigured()) throw new Error("codapay_not_configured");
  const response = await fetch(
    `https://${host()}/airtime/api/restful/v2.0/Payment/${endpoint}.json`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) throw new Error(`Codapay HTTP ${response.status}`);
  // Transaction IDs exceed Number.MAX_SAFE_INTEGER. Preserve all numeric lexemes.
  return parse(await response.text(), undefined, (value) => value);
}

export function codapayAmountToMinor(value: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value))
    throw new Error("Invalid Codapay amount");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
}

export function verifyCodapayChecksum(input: {
  TxnId: string;
  OrderId: string;
  ResultCode: string;
  Checksum: string;
}) {
  if (!env.CODAPAY_API_KEY || !/^[a-f\d]{32}$/i.test(input.Checksum))
    return false;
  const expected = createHash("md5")
    .update(
      `${input.TxnId}${env.CODAPAY_API_KEY}${input.OrderId}${input.ResultCode}`,
    )
    .digest();
  return timingSafeEqual(expected, Buffer.from(input.Checksum, "hex"));
}

export async function createCodapayInvoice(input: {
  amount: bigint;
  orderId: string;
  userId: string;
  country: CodapayCountry;
}) {
  if (input.amount <= 0n || input.amount > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Invalid Codapay amount");
  const result = z
    .object({
      initResult: z.object({
        resultCode: z.literal("0"),
        txnId: z.string().regex(/^[1-9]\d*$/),
        redirectUrl: z.string().url(),
      }),
    })
    .parse(
      await call("init", {
        initRequest: {
          apiKey: env.CODAPAY_API_KEY,
          projectId: env.CODAPAY_PROJECT_ID,
          country: Number(alpha2ToNumeric(input.country)),
          payType: 0,
          currency: 840,
          orderId: input.orderId,
          isTaxInclusiveAmount: true,
          items: [
            {
              code: input.orderId,
              name: "Simverse eSIM",
              price: Number(input.amount) / 100,
            },
          ],
          profile: {
            entry: [
              { key: "user_id", value: input.userId },
              {
                key: "return_url",
                value: apiPublicUrl(
                  "/checkout/codapay/return?orderId={orderId}&txnId={transactionId}",
                ),
              },
            ],
          },
        },
      }),
    );
  const url = new URL(result.initResult.redirectUrl);
  if (url.protocol !== "https:" || url.hostname !== host())
    throw new Error("Invalid Codapay redirect URL");
  return { id: result.initResult.txnId, url: url.toString() };
}

export async function getCodapayPayment(txnId: string) {
  const result = z
    .object({
      paymentResult: z.object({
        txnId: z.string().regex(/^[1-9]\d*$/),
        orderId: z.string().uuid(),
        resultCode: z.string().regex(/^\d+$/),
        originAmount: z.string().optional(),
        originCurrency: z.string().optional(),
      }),
    })
    .parse(
      await call("inquiryPaymentResult", {
        inquiryPaymentRequest: {
          apiKey: env.CODAPAY_API_KEY,
          projectId: env.CODAPAY_PROJECT_ID,
          txnId,
          needStatusFinal: "true",
        },
      }),
    );
  if (result.paymentResult.txnId !== txnId)
    throw new Error("Codapay transaction mismatch");
  return result.paymentResult;
}
