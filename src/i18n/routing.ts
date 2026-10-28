import { defineRouting } from "next-intl/routing";

/**
 * Persistent on purpose. next-intl's default cookie has no maxAge, so it dies
 * when Telegram destroys the Mini App WebView and Accept-Language (the client
 * language) takes over.
 */
export const localeCookie = {
  name: "NEXT_LOCALE",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 365,
};

export const routing = defineRouting({
  locales: ["en", "ru"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  localeCookie,
});

/**
 * Marketing site and blog. The URL is the only locale signal, so a crawler
 * is not redirected from `/` to `/ru`, and hreflang is set in page metadata
 * (article slugs differ per language).
 */
export const publicRouting = defineRouting({
  locales: ["en", "ru"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  localeCookie,
  localeDetection: false,
  alternateLinks: false,
});
