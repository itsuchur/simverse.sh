import { describe, expect, test } from "bun:test";

import {
  isFupPackageName,
  parseName,
} from "~/server/suppliers/esimaccess/parse-package-name";

describe("parseName", () => {
  test("parses the allowance and FUP speed from a daily plan", () => {
    expect(parseName("Japan 3GB/Day FUP1Mbps (IIJ)")).toMatchObject({
      amount: "3",
      unit: "GB",
      perDay: true,
      fup: { value: 1, unit: "M" },
    });
  });

  test("parses the allowance and FUP speed from a total plan", () => {
    expect(parseName("Europe 5GB 30Days FUP512Kbps")).toMatchObject({
      amount: "5",
      unit: "GB",
      perDay: false,
      days: 30,
      fup: { value: 512, unit: "K" },
    });
  });

  test("keeps fixed plans distinct from FUP plans", () => {
    expect(parseName("Spain 5GB 30Days")).toEqual({
      label: "Spain",
      amount: "5",
      unit: "GB",
      perDay: false,
      days: 30,
      fup: undefined,
      modifier: undefined,
    });
  });
});

describe("isFupPackageName", () => {
  test("identifies FUP packages as unlimited", () => {
    expect(isFupPackageName("Spain 1GB/Day FUP512Kbps")).toBe(true);
    expect(isFupPackageName("Unstructured FUP2Mbps plan")).toBe(true);
  });

  test("does not identify fixed packages as unlimited", () => {
    expect(isFupPackageName("Spain 5GB 30Days")).toBe(false);
  });
});
