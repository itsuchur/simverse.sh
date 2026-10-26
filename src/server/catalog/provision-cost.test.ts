import { describe, expect, test } from "bun:test";

import {
  exceedsScaledProvisionCost,
  exceedsUsdProvisionCost,
} from "~/server/catalog/provision-cost";

const ESIMACCESS_SCALE = 10_000;

describe("exceedsUsdProvisionCost", () => {
  test("keeps amounts under $100, including $99.9999", () => {
    expect(exceedsUsdProvisionCost(0)).toBe(false);
    expect(exceedsUsdProvisionCost(99.9999)).toBe(false);
  });

  test("drops $100 and above", () => {
    expect(exceedsUsdProvisionCost(100)).toBe(true);
    expect(exceedsUsdProvisionCost(100.01)).toBe(true);
  });

  test("leaves non-finite amounts alone", () => {
    expect(exceedsUsdProvisionCost(Number.NaN)).toBe(false);
    expect(exceedsUsdProvisionCost(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("exceedsScaledProvisionCost", () => {
  test("keeps a scaled cost under $100", () => {
    expect(exceedsScaledProvisionCost(999_999, ESIMACCESS_SCALE)).toBe(false);
  });

  test("drops a scaled cost of $100 and above", () => {
    expect(exceedsScaledProvisionCost(1_000_000, ESIMACCESS_SCALE)).toBe(true);
    expect(exceedsScaledProvisionCost(1_000_001, ESIMACCESS_SCALE)).toBe(true);
  });
});
