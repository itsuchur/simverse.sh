import { describe, expect, test } from "bun:test";

import {
  discountedSbpCents,
  PLATEGA_SBP_DISCOUNT_PERCENT,
} from "~/lib/platega";

describe("discountedSbpCents", () => {
  test("applies the advertised five percent discount in cents", () => {
    expect(PLATEGA_SBP_DISCOUNT_PERCENT).toBe(5);
    expect(discountedSbpCents(1000)).toBe(95_000);
    expect(discountedSbpCents(999)).toBe(94_905);
  });
});
