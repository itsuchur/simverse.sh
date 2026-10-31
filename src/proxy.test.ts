import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";

import {
  PUBLIC_PATHNAME_HEADER,
  PUBLIC_SEARCH_HEADER,
} from "./i18n/preferred-locale";
import proxy from "./proxy";

function request(url: string, acceptLanguage = "en") {
  const host = new URL(url).host;
  return new NextRequest(url, {
    headers: {
      host,
      "x-forwarded-host": host,
      "accept-language": acceptLanguage,
    },
  });
}

function pathnameOf(header: string | null): string | null {
  if (!header) return null;
  return new URL(header, "https://miniapp.simverse.sh").pathname;
}

describe("miniapp host locale routing", () => {
  test("rewrites the default locale root to the mini app", () => {
    const response = proxy(
      request("https://miniapp.simverse.sh/?tgWebAppStartParam=ok"),
    );
    expect(response.headers.get("location")).toBeNull();
    expect(pathnameOf(response.headers.get("x-middleware-rewrite"))).toBe(
      "/en/app",
    );
    expect(
      response.headers.get(`x-middleware-request-${PUBLIC_PATHNAME_HEADER}`),
    ).toBe("/");
    expect(
      response.headers.get(`x-middleware-request-${PUBLIC_SEARCH_HEADER}`),
    ).toBe("?tgWebAppStartParam=ok");
  });

  test("redirects a Russian root to the public locale path", () => {
    const response = proxy(request("https://miniapp.simverse.sh/", "ru"));
    expect(response.status).toBe(307);
    expect(pathnameOf(response.headers.get("location"))).toBe("/ru");
  });

  test("remembers a non-default locale in a persistent cookie", () => {
    const response = proxy(request("https://miniapp.simverse.sh/ru", "en"));
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("NEXT_LOCALE=ru");
    expect(setCookie.toLowerCase()).toContain("max-age=31536000");
  });

  test("rewrites the Russian locale root to the mini app", () => {
    const response = proxy(request("https://miniapp.simverse.sh/ru", "ru"));
    expect(response.headers.get("location")).toBeNull();
    expect(pathnameOf(response.headers.get("x-middleware-rewrite"))).toBe(
      "/ru/app",
    );
  });

  test("rewrites nested Russian paths under the mini app", () => {
    const response = proxy(
      request("https://miniapp.simverse.sh/ru/profile", "ru"),
    );
    expect(pathnameOf(response.headers.get("x-middleware-rewrite"))).toBe(
      "/ru/app/profile",
    );
  });

  test("strips a leaked internal prefix back to the public path", () => {
    const response = proxy(request("https://miniapp.simverse.sh/ru/app", "ru"));
    expect(response.status).toBe(308);
    expect(pathnameOf(response.headers.get("location"))).toBe("/ru");
  });

  test("leaves mini app legal pages at the locale root", () => {
    const response = proxy(
      request("https://miniapp.simverse.sh/ru/help", "ru"),
    );
    expect(pathnameOf(response.headers.get("x-middleware-rewrite"))).not.toBe(
      "/ru/app/help",
    );
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("other hosts", () => {
  for (const locale of ["en", "ru"]) {
    test(`an explicit ${locale} blog link overrides a conflicting blog language cookie`, () => {
      const otherLocale = locale === "en" ? "ru" : "en";
      const response = proxy(
        new NextRequest(`https://simverse.sh/${locale}/blog`, {
          headers: {
            host: "simverse.sh",
            "accept-language": otherLocale,
            cookie: `NEXT_LOCALE=${otherLocale}`,
          },
        }),
      );
      expect(response.headers.get("set-cookie")).toContain(
        `NEXT_LOCALE=${locale}`,
      );
      if (locale === "en") {
        expect(pathnameOf(response.headers.get("location"))).toBe("/blog");
      } else {
        expect(response.headers.get("location")).toBeNull();
        expect(response.headers.get("x-middleware-next")).toBe("1");
      }
    });
  }

  test("rewrites the Russian dashboard root under /dashboard", () => {
    const response = proxy(request("https://dashboard.simverse.sh/ru", "ru"));
    expect(pathnameOf(response.headers.get("x-middleware-rewrite"))).toBe(
      "/ru/dashboard",
    );
  });

  test("keeps the marketing site on the locale root", () => {
    const response = proxy(request("https://simverse.sh/ru", "ru"));
    expect(pathnameOf(response.headers.get("x-middleware-rewrite"))).not.toBe(
      "/ru/app",
    );
    expect(response.headers.get("location")).toBeNull();
  });

  test("does not negotiate the marketing locale from Accept-Language", () => {
    const response = proxy(request("https://simverse.sh/", "ru"));
    expect(response.headers.get("location")).toBeNull();
    expect(pathnameOf(response.headers.get("x-middleware-rewrite"))).toBe(
      "/en",
    );
  });

  test("does not negotiate the blog locale from a saved cookie", () => {
    const response = proxy(
      new NextRequest("https://simverse.sh/blog", {
        headers: {
          host: "simverse.sh",
          "accept-language": "ru",
          cookie: "NEXT_LOCALE=ru",
        },
      }),
    );
    expect(response.headers.get("location")).toBeNull();
    expect(pathnameOf(response.headers.get("x-middleware-rewrite"))).toBe(
      "/en/blog",
    );
  });

  test("redirects www and a trailing slash to the apex path", () => {
    const response = proxy(request("https://www.simverse.sh/ru/tos/?x=1"));
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "https://simverse.sh/ru/tos?x=1",
    );
  });

  test("serves an apex blog article without a host redirect", () => {
    const response = proxy(
      request("https://simverse.sh/blog/how-to-install-an-e-sim"),
    );
    expect(response.headers.get("location")).toBeNull();
    expect(pathnameOf(response.headers.get("x-middleware-rewrite"))).toBe(
      "/en/blog/how-to-install-an-e-sim",
    );
  });

  for (const [oldPath, newPath] of [
    ["/", "/blog"],
    ["/ru", "/ru/blog"],
    ["/how-to-install-an-e-sim", "/blog/how-to-install-an-e-sim"],
    ["/ru/kak-ustanovit-e-sim/", "/ru/blog/kak-ustanovit-e-sim"],
  ]) {
    test(`301 redirects the old blog ${oldPath}, preserving query parameters`, () => {
      const response = proxy(
        request(`https://blog.simverse.sh${oldPath}?tag=Travel&page=2`),
      );
      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(
        `https://simverse.sh${newPath}?tag=Travel&page=2`,
      );
    });
  }
});
