import { describe, expect, test } from "bun:test";
import { USD_PER_STAR, usdToStars } from "~/lib/usd-to-stars";

describe("usdToStars", () => {
  test("uses $0.03 per Star", () => {
    expect(USD_PER_STAR).toBe(0.03);
  });

  test("converts exact multiples without rounding up extra", () => {
    expect(usdToStars(0.03)).toBe(1);
    expect(usdToStars(0.06)).toBe(2);
  });

  test("rounds up to whole Stars", () => {
    expect(usdToStars(0.01)).toBe(1);
    expect(usdToStars(0.031)).toBe(2);
  });
});
