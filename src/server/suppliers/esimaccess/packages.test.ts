import { describe, expect, test } from "bun:test";

import { usdToStars } from "~/lib/usd-to-stars";
import {
  ESIMACCESS_PRICE_SCALE,
  retailPriceToRub,
  retailPriceToStars,
  retailPriceToUsd,
} from "~/server/suppliers/esimaccess/packages";

describe("retailPriceToUsd", () => {
  test("ceils fractional dollars", () => {
    expect(retailPriceToUsd(17_800)).toBe(2);
    expect(retailPriceToUsd(21_200)).toBe(3);
  });

  test("keeps exact dollars", () => {
    expect(retailPriceToUsd(10 * ESIMACCESS_PRICE_SCALE)).toBe(10);
  });

  test("never goes below 1", () => {
    expect(retailPriceToUsd(8_100)).toBe(1);
  });
});

describe("retailPriceToRub", () => {
  test("ceils instead of rounding down", () => {
    expect(retailPriceToRub(ESIMACCESS_PRICE_SCALE, 9.6)).toBe(10);
  });

  test("never goes below 1", () => {
    expect(retailPriceToRub(ESIMACCESS_PRICE_SCALE, 0.4)).toBe(1);
  });
});

describe("retailPriceToStars", () => {
  test("still ceils from unrounded USD", () => {
    const retailPrice = 17_800;
    expect(retailPriceToStars(retailPrice)).toBe(
      usdToStars(retailPrice / ESIMACCESS_PRICE_SCALE),
    );
  });
});
