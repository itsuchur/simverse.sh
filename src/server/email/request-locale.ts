import type { WelcomeLocale } from "~/server/telegram/start-welcome";

/**
 * Locale of the web page that called an auth endpoint. The URL prefix
 * (`/ru/checkout`) wins, then the next-intl cookie, then Accept-Language.
 */
export function requestLocale(headers: Headers | undefined): WelcomeLocale {
  if (!headers) return "en";

  const referer = headers.get("referer");
  if (referer) {
    try {
      const { pathname } = new URL(referer);
      if (pathname === "/ru" || pathname.startsWith("/ru/")) return "ru";
      return "en";
    } catch {
      // Fall through to the cookie and Accept-Language.
    }
  }

  const cookieLocale = /(?:^|;\s*)NEXT_LOCALE=(en|ru)(?:;|$)/.exec(
    headers.get("cookie") ?? "",
  )?.[1];
  if (cookieLocale === "en" || cookieLocale === "ru") return cookieLocale;

  return headers.get("accept-language")?.trim().toLowerCase().startsWith("ru")
    ? "ru"
    : "en";
}
