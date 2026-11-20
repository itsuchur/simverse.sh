import { z } from "zod";

import { routing } from "~/i18n/routing";

/** Where a checkout started: the Telegram Mini App or the public website. */
export const checkoutChannelSchema = z.enum(["miniapp", "web"]);
export type CheckoutChannel = z.infer<typeof checkoutChannelSchema>;

type Locale = (typeof routing.locales)[number];

function localeOf(value: string | null | undefined): Locale {
  return (
    routing.locales.find((locale) => locale === value) ?? routing.defaultLocale
  );
}

/**
 * Query appended to provider return URLs so the return route knows where to
 * send the buyer. Mini App checkouts keep their URLs unchanged.
 */
export function returnChannelQuery(
  channel: CheckoutChannel | undefined,
  locale: string | undefined,
): string {
  if (channel !== "web") return "";
  return `channel=web&locale=${localeOf(locale)}`;
}

/** Appends `returnChannelQuery` to a path that may already have a query. */
export function withReturnChannel(
  path: string,
  channel: CheckoutChannel | undefined,
  locale: string | undefined,
): string {
  const query = returnChannelQuery(channel, locale);
  if (!query) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${query}`;
}

export function readReturnChannel(params: URLSearchParams): {
  channel: CheckoutChannel;
  locale: Locale;
} {
  return {
    channel: params.get("channel") === "web" ? "web" : "miniapp",
    locale: localeOf(params.get("locale")),
  };
}

/** Website page a buyer lands on after leaving the payment provider. */
export function webPaymentResultPath(
  result: "success" | "fail",
  locale: string,
): string {
  const prefix =
    localeOf(locale) === routing.defaultLocale ? "" : `/${localeOf(locale)}`;
  return result === "success"
    ? `${prefix}/account?payment=success`
    : `${prefix}/checkout?payment=failed`;
}
