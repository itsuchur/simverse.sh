import { describe, expect, test } from "bun:test";

import { usdToStars } from "~/lib/usd-to-stars";
import {
  ESIMACCESS_PRICE_SCALE,
  retailPriceToRub,
  retailPriceToStars,
  retailPriceToUsd,
  withPriceRub,
  type EsimAccessPackage,
} from "~/server/suppliers/esimaccess/packages";

function samplePackage(
  overrides: Partial<EsimAccessPackage> = {},
): EsimAccessPackage {
  return {
    packageCode: "PKG1",
    slug: "pkg1",
    name: "1GB 7Days",
    price: 5_000,
    retailPrice: ESIMACCESS_PRICE_SCALE,
    currencyCode: "USD",
    volume: 1024 ** 3,
    duration: 7,
    durationUnit: "DAY",
    location: "US",
    ...overrides,
  };
}

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

describe("withPriceRub", () => {
  test("default modifier leaves derived prices unchanged vs helpers", () => {
    const pkg = samplePackage({ retailPrice: 17_800 });
    const [priced] = withPriceRub([pkg], 100);
    expect(priced?.priceRub).toBe(retailPriceToRub(17_800, 100));
    expect(priced?.priceUsd).toBe(retailPriceToUsd(17_800));
    expect(priced?.priceStars).toBe(retailPriceToStars(17_800));
    expect(priced?.retailPrice).toBe(17_800);
    expect(priced?.price).toBe(5_000);
  });

  test("multiplies customer-facing prices by modifier", () => {
    const pkg = samplePackage({ retailPrice: ESIMACCESS_PRICE_SCALE });
    const [priced] = withPriceRub([pkg], 10, 2);
    expect(priced?.priceRub).toBe(retailPriceToRub(ESIMACCESS_PRICE_SCALE * 2, 10));
    expect(priced?.priceUsd).toBe(retailPriceToUsd(ESIMACCESS_PRICE_SCALE * 2));
    expect(priced?.priceStars).toBe(
      retailPriceToStars(ESIMACCESS_PRICE_SCALE * 2),
    );
    expect(priced?.retailPrice).toBe(ESIMACCESS_PRICE_SCALE);
    expect(priced?.price).toBe(5_000);
  });
});
