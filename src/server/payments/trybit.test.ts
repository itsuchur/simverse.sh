import { describe, expect, test } from "bun:test";

import { signTrybitToken } from "~/test/mocks";
import { verifyTrybitPostbackToken } from "~/server/payments/trybit";

const now = () => Math.floor(Date.now() / 1000);

describe("verifyTrybitPostbackToken", () => {
  test("accepts a valid HS256 token", () => {
    expect(verifyTrybitPostbackToken(signTrybitToken())).toBe(true);
  });

  test("accepts a token within its nbf/exp window", () => {
    const token = signTrybitToken({ nbf: now() - 60, exp: now() + 60 });
    expect(verifyTrybitPostbackToken(token)).toBe(true);
  });

  test("rejects a token signed with the wrong secret", () => {
    const token = signTrybitToken({}, { secret: "attacker-secret" });
    expect(verifyTrybitPostbackToken(token)).toBe(false);
  });

  test("rejects a tampered payload", () => {
    const token = signTrybitToken({ order: "a" });
    const [header, , signature] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ order: "b" }))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(
      verifyTrybitPostbackToken(`${header}.${forgedPayload}.${signature}`),
    ).toBe(false);
  });

  test("rejects non-HS256 algorithms", () => {
    expect(
      verifyTrybitPostbackToken(signTrybitToken({}, { alg: "none" })),
    ).toBe(false);
    expect(
      verifyTrybitPostbackToken(signTrybitToken({}, { alg: "HS512" })),
    ).toBe(false);
  });

  test("rejects malformed tokens", () => {
    expect(verifyTrybitPostbackToken("")).toBe(false);
    expect(verifyTrybitPostbackToken("abc")).toBe(false);
    expect(verifyTrybitPostbackToken("a.b")).toBe(false);
    expect(verifyTrybitPostbackToken("a.b.c.d")).toBe(false);
    expect(verifyTrybitPostbackToken("not-base64.!!.sig")).toBe(false);
  });

  test("rejects an expired token", () => {
    expect(verifyTrybitPostbackToken(signTrybitToken({ exp: now() - 1 }))).toBe(
      false,
    );
  });

  test("rejects a token used before nbf", () => {
    expect(
      verifyTrybitPostbackToken(signTrybitToken({ nbf: now() + 3600 })),
    ).toBe(false);
  });
});
