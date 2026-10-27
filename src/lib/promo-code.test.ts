import { describe, expect, test } from "bun:test";

import { discountMinor, parsePromoCode, readPromoCode } from "./promo-code";

describe("parsePromoCode", () => {
  test("uppercases letters and digits", () => {
    expect(parsePromoCode("  welcome10 ")).toBe("WELCOME10");
    expect(parsePromoCode("AB12")).toBe("AB12");
  });

  test("rejects special characters, spaces, and the wrong length", () => {
    expect(parsePromoCode("WELCOME10'; DROP TABLE promo_codes;--")).toBeNull();
    expect(parsePromoCode("WELCOME-10")).toBeNull();
    expect(parsePromoCode("WELCOME 10")).toBeNull();
    expect(parsePromoCode("код10")).toBeNull();
    expect(parsePromoCode("ABC")).toBeNull();
    expect(parsePromoCode("A".repeat(33))).toBeNull();
    expect(readPromoCode(undefined)).toBeUndefined();
    expect(readPromoCode("   ")).toBeUndefined();
    expect(readPromoCode("' OR 1=1 --")).toBeNull();
  });
});

describe("discountMinor", () => {
  test("takes an integer percent off minor units", () => {
    expect(discountMinor(10_000n, 10)).toBe(9_000n);
    expect(discountMinor(100n, 99)).toBe(1n);
  });

  test("rejects a discount that would not change the charge", () => {
    expect(discountMinor(1n, 10)).toBeNull();
    expect(discountMinor(0n, 10)).toBeNull();
    expect(discountMinor(10_000n, 0)).toBeNull();
    expect(discountMinor(10_000n, 100)).toBeNull();
  });
});
