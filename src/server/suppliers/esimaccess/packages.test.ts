import { describe, expect, test } from "bun:test";

import { usdToStars } from "~/lib/usd-to-stars";
import {
  ESIMACCESS_PRICE_SCALE,
  retailPriceToRub,
  retailPriceToStars,
  retailPriceToUsd,
} from "~/server/suppliers/esimaccess/packages";

describe("retailPriceToUsd", () => {
  test("floors fractional dollars", () => {
    expect(retailPriceToUsd(98_100)).toBe(9);
  });

  test("keeps exact dollars", () => {
    expect(retailPriceToUsd(10 * ESIMACCESS_PRICE_SCALE)).toBe(10);
  });

  test("never goes below 1", () => {
    expect(retailPriceToUsd(8_100)).toBe(1);
  });
});

describe("retailPriceToRub", () => {
  test("floors instead of rounding to nearest", () => {
    expect(retailPriceToRub(ESIMACCESS_PRICE_SCALE, 9.6)).toBe(9);
  });

  test("never goes below 1", () => {
    expect(retailPriceToRub(ESIMACCESS_PRICE_SCALE, 0.4)).toBe(1);
  });
});

describe("retailPriceToStars", () => {
  test("still ceils from unfloored USD", () => {
    const retailPrice = 98_100;
    expect(retailPriceToStars(retailPrice)).toBe(
      usdToStars(retailPrice / ESIMACCESS_PRICE_SCALE),
    );
  });
});
