import { env } from "~/env";
import {
  readReturnChannel,
  webPaymentResultPath,
} from "~/lib/checkout-channel";
import { MARKETING_ORIGIN } from "~/lib/public-url";

/** Used when Docker `next build` skips env validation and URLs are unset. */
export const FALLBACK_ORIGIN = "http://localhost:3000";

function origin(url: string | undefined) {
  return (url ?? FALLBACK_ORIGIN).replace(/\/$/, "");
}

export function dashboardOrigin() {
  return origin(env.BETTER_AUTH_URL);
}

export function miniappOrigin() {
  return origin(env.MINIAPP_URL ?? env.BETTER_AUTH_URL);
}

export function apiOrigin() {
  return origin(env.API_URL ?? env.BETTER_AUTH_URL);
}

/**
 * Telegram deep link that reopens the Mini App and routes to the payment
 * result screen via `start_param` (handled by <StartParamRouter />).
 */
export function miniappDeepLink(result: "success" | "fail") {
  const startapp = result === "fail" ? "failed_payment" : "successful_payment";
  return `https://t.me/${env.TELEGRAM_BOT_USERNAME}?startapp=${startapp}`;
}

export function marketingOrigin() {
  return origin(env.MARKETING_URL ?? MARKETING_ORIGIN);
}

/**
 * Where a payment return route sends the buyer: the Mini App deep link, or
 * the website account/checkout page for checkouts started on the web.
 */
export function paymentReturnTarget(
  result: "success" | "fail",
  params: URLSearchParams,
) {
  const { channel, locale } = readReturnChannel(params);
  if (channel === "miniapp") return miniappDeepLink(result);
  return `${marketingOrigin()}${webPaymentResultPath(result, locale)}`;
}

/** Public webhook/API path. Dedicated `API_URL` host omits `/api`; local/ngrok keeps it. */
export function apiPublicUrl(pathname: string) {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (env.API_URL) {
    return `${apiOrigin()}${path}`;
  }
  return `${apiOrigin()}/api${path}`;
}
