import "server-only";

import {
  Client,
  Environment,
  OrdersController,
  CheckoutPaymentIntent,
  PaypalWalletContextShippingPreference,
  PaypalExperienceUserAction,
  type OAuthToken,
} from "@paypal/paypal-server-sdk";
import { z } from "zod";
import { env } from "~/env";
import { apiPublicUrl } from "~/server/urls";

export function paypalConfigured() {
  return Boolean(
    env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET && env.PAYPAL_WEBHOOK_ID,
  );
}

let client: Client | undefined;
function paypalClient() {
  if (!paypalConfigured()) throw new Error("paypal_not_configured");
  return (client ??= new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: env.PAYPAL_CLIENT_ID!,
      oAuthClientSecret: env.PAYPAL_CLIENT_SECRET!,
    },
    environment:
      env.PAYPAL_ENVIRONMENT === "production"
        ? Environment.Production
        : Environment.Sandbox,
    timeout: 10_000,
  }));
}

export function paypalAmountToMinor(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error("Invalid PayPal amount");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
}

export async function createPaypalInvoice(input: {
  amount: bigint;
  orderId: string;
}) {
  if (input.amount <= 0n) throw new Error("Invalid PayPal amount");
  const { result } = await new OrdersController(paypalClient()).createOrder({
    paypalRequestId: input.orderId,
    body: {
      intent: CheckoutPaymentIntent.Capture,
      purchaseUnits: [
        {
          customId: input.orderId,
          invoiceId: input.orderId,
          amount: {
            currencyCode: "USD",
            value: `${input.amount / 100n}.${String(input.amount % 100n).padStart(2, "0")}`,
          },
        },
      ],
      paymentSource: {
        paypal: {
          experienceContext: {
            shippingPreference:
              PaypalWalletContextShippingPreference.NoShipping,
            userAction: PaypalExperienceUserAction.PayNow,
            returnUrl: apiPublicUrl("/checkout/paypal/return"),
            cancelUrl: apiPublicUrl("/checkout/paypal/return?status=fail"),
          },
        },
      },
    },
  });
  const link = result.links?.find(
    (link) => link.rel === "payer-action" || link.rel === "approve",
  )?.href;
  if (!result.id || !link)
    throw new Error("PayPal order missing approval link");
  const url = new URL(link);
  const host =
    env.PAYPAL_ENVIRONMENT === "production"
      ? "www.paypal.com"
      : "www.sandbox.paypal.com";
  if (url.protocol !== "https:" || url.hostname !== host)
    throw new Error("Invalid PayPal approval URL");
  return { uuid: result.id, link };
}

// Normalize SDK responses at the provider boundary; no payer details enter fulfillment.
const amountSchema = z.object({ currencyCode: z.string(), value: z.string() });
export const paypalOrderSchema = z.object({
  id: z.string().min(1),
  status: z.string(),
  purchaseUnits: z
    .array(
      z.object({
        customId: z.string().min(1),
        amount: amountSchema,
        payments: z
          .object({
            captures: z
              .array(
                z.object({
                  id: z.string().min(1),
                  status: z.string(),
                  amount: amountSchema,
                  finalCapture: z.boolean().optional(),
                }),
              )
              .optional(),
          })
          .optional(),
      }),
    )
    .length(1),
});
export type PaypalOrder = z.infer<typeof paypalOrderSchema>;

export async function getPaypalOrder(id: string) {
  const { result } = await new OrdersController(paypalClient()).getOrder({
    id,
  });
  return paypalOrderSchema.parse(result);
}

export async function capturePaypalOrder(id: string) {
  const { result } = await new OrdersController(paypalClient()).captureOrder({
    id,
    paypalRequestId: `capture-${id}`,
    prefer: "return=representation",
  });
  return paypalOrderSchema.parse(result);
}

let verificationToken: OAuthToken | undefined;
export async function verifyPaypalWebhook(headers: Headers, payload: unknown) {
  const fields = {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
  };
  if (!paypalConfigured() || Object.values(fields).some((value) => !value))
    return false;
  verificationToken =
    await paypalClient().clientCredentialsAuthManager.updateToken(
      verificationToken,
    );
  const base =
    env.PAYPAL_ENVIRONMENT === "production"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";
  // The server SDK has no Webhooks controller. Use its OAuth manager for this endpoint.
  const response = await fetch(
    `${base}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${verificationToken.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...fields,
        webhook_id: env.PAYPAL_WEBHOOK_ID,
        webhook_event: payload,
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok)
    throw new Error(
      `PayPal webhook verification unavailable: ${response.status}`,
    );
  const body = z
    .object({ verification_status: z.string() })
    .parse(await response.json());
  return body.verification_status === "SUCCESS";
}
