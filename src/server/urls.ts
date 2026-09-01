import { env } from "~/env";

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
  const startapp =
    result === "fail" ? "failed_payment" : "successful_payment";
  return `https://t.me/${env.TELEGRAM_BOT_USERNAME}?startapp=${startapp}`;
}

/** Public webhook/API path. Dedicated `API_URL` host omits `/api`; local/ngrok keeps it. */
export function apiPublicUrl(pathname: string) {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (env.API_URL) {
    return `${apiOrigin()}${path}`;
  }
  return `${apiOrigin()}/api${path}`;
}
