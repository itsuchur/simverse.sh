import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";

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
    const response = proxy(request("https://miniapp.simverse.sh/"));
    expect(response.headers.get("location")).toBeNull();
    expect(pathnameOf(response.headers.get("x-middleware-rewrite"))).toBe(
      "/en/app",
    );
  });

  test("redirects a Russian root to the public locale path", () => {
    const response = proxy(
      request("https://miniapp.simverse.sh/", "ru"),
    );
    expect(response.status).toBe(307);
    expect(pathnameOf(response.headers.get("location"))).toBe("/ru");
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
    const response = proxy(
      request("https://miniapp.simverse.sh/ru/app", "ru"),
    );
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
  test("rewrites the Russian dashboard root under /dashboard", () => {
    const response = proxy(
      request("https://dashboard.simverse.sh/ru", "ru"),
    );
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
});
