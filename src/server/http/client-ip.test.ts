import { describe, expect, test } from "bun:test";

import { clientIpFromHeaders } from "~/server/http/client-ip";

describe("clientIpFromHeaders", () => {
  test("prefers CF-Connecting-IP over other proxy headers", () => {
    const headers = new Headers({
      "cf-connecting-ip": "203.0.113.10",
      "true-client-ip": "203.0.113.11",
      "x-real-ip": "10.0.0.1",
      "x-forwarded-for": "198.51.100.1, 10.0.0.1",
    });
    expect(clientIpFromHeaders(headers)).toBe("203.0.113.10");
  });

  test("uses True-Client-IP when CF-Connecting-IP is absent", () => {
    const headers = new Headers({
      "true-client-ip": "2001:db8::1",
      "x-real-ip": "10.0.0.1",
    });
    expect(clientIpFromHeaders(headers)).toBe("2001:db8::1");
  });

  test("falls back to X-Real-IP", () => {
    const headers = new Headers({
      "x-real-ip": "192.0.2.40",
      "x-forwarded-for": "198.51.100.1",
    });
    expect(clientIpFromHeaders(headers)).toBe("192.0.2.40");
  });

  test("uses the leftmost valid X-Forwarded-For hop", () => {
    const headers = new Headers({
      "x-forwarded-for": "unknown, 198.51.100.20, 10.0.0.1",
    });
    expect(clientIpFromHeaders(headers)).toBe("198.51.100.20");
  });

  test("returns null for missing or invalid values", () => {
    expect(clientIpFromHeaders(new Headers())).toBeNull();
    expect(
      clientIpFromHeaders(new Headers({ "cf-connecting-ip": "not-an-ip" })),
    ).toBeNull();
  });
});
