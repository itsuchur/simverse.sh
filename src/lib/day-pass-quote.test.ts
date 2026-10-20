import { describe, expect, test } from "bun:test";

import { quoteDayPassAmount } from "~/lib/day-pass-quote";

describe("quoteDayPassAmount", () => {
  test("re-discounts a 30-day price for a 5-day extension", () => {
    // 30 days at 18% off of a 100000 daily rate is 2_460_000.
    // 5 days at 8% off is 460_000.
    expect(
      quoteDayPassAmount({
        retailPrice: 2_460_000,
        durationDays: 30,
        extendDays: 5,
      }),
    ).toBe(460_000);
  });

  test("rejects lengths outside 1–365 days", () => {
    expect(
      quoteDayPassAmount({
        retailPrice: 2_460_000,
        durationDays: 30,
        extendDays: 0,
      }),
    ).toBeNull();
    expect(
      quoteDayPassAmount({
        retailPrice: 2_460_000,
        durationDays: 0,
        extendDays: 5,
      }),
    ).toBeNull();
    expect(
      quoteDayPassAmount({
        retailPrice: 2_460_000,
        durationDays: 30,
        extendDays: 366,
      }),
    ).toBeNull();
  });
});
