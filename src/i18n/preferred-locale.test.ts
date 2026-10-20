import { describe, expect, test } from "bun:test";

import {
  preferredLocaleRedirectTarget,
  publicPathForLocale,
} from "./preferred-locale";
import { localeCookie } from "./routing";

describe("preferredLocaleRedirectTarget", () => {
  test("sends an unprefixed mini app open to the saved language", () => {
    expect(preferredLocaleRedirectTarget("en", "ru", "/", "")).toBe("/ru");
  });

  test("keeps the page and query when switching locale", () => {
    expect(
      preferredLocaleRedirectTarget(
        "en",
        "ru",
        "/profile",
        "?tgWebAppStartParam=successful_payment",
      ),
    ).toBe("/ru/profile?tgWebAppStartParam=successful_payment");
  });

  test("drops back to the unprefixed path for English", () => {
    expect(preferredLocaleRedirectTarget("ru", "en", "/ru/profile", "")).toBe(
      "/profile",
    );
  });

  test("leaves a local /app path in place", () => {
    expect(preferredLocaleRedirectTarget("en", "ru", "/app/profile", "")).toBe(
      "/ru/app/profile",
    );
  });

  test("does nothing when the page is already in the saved language", () => {
    expect(preferredLocaleRedirectTarget("ru", "ru", "/ru", "")).toBeNull();
    expect(preferredLocaleRedirectTarget("en", "en", "/", "")).toBeNull();
    expect(preferredLocaleRedirectTarget("en", null, "/", "")).toBeNull();
    expect(preferredLocaleRedirectTarget("en", "de", "/", "")).toBeNull();
  });

  test("rejects a path we did not produce", () => {
    expect(
      preferredLocaleRedirectTarget("en", "ru", "//evil.example", ""),
    ).toBe(null);
    expect(preferredLocaleRedirectTarget("en", "ru", "/profile", "?\n")).toBe(
      "/ru/profile",
    );
  });
});

describe("publicPathForLocale", () => {
  test("prefixes only the non-default locale", () => {
    expect(publicPathForLocale("/ru/myesim", "en")).toBe("/myesim");
    expect(publicPathForLocale("/myesim", "ru")).toBe("/ru/myesim");
  });
});

test("locale cookie outlives a Telegram WebView session", () => {
  expect(localeCookie).toMatchObject({
    name: "NEXT_LOCALE",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
});
