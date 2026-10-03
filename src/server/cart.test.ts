import { describe, expect, test } from "bun:test";

import { cartPlanSchema } from "~/lib/cart-plan";

function cartPlan(isUnlimited: boolean) {
  return {
    supplier: "esimaccess" as const,
    packageCode: "PKG-1",
    slug: "pkg-1",
    country: "ES",
    data_gb: 1,
    validity_days: 7,
    price: 2,
    price_rub: 200,
    price_stars: 100,
    cost: 10_000,
    currency: "USD" as const,
    qty: 1 as const,
    networks: [],
    name: "Spain 1GB/Day FUP1Mbps",
    isUnlimited,
  };
}

describe("cartPlanSchema", () => {
  test("preserves unlimited metadata in the stored cart", () => {
    expect(cartPlanSchema.parse(cartPlan(true)).isUnlimited).toBe(true);
  });

  test("requires unlimited metadata", () => {
    const { isUnlimited, ...withoutUnlimited } = cartPlan(false);
    expect(isUnlimited).toBe(false);
    expect(cartPlanSchema.safeParse(withoutUnlimited).success).toBe(false);
  });
});
