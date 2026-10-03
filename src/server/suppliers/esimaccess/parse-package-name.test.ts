import { describe, expect, test } from "bun:test";

import {
  isFupPackageName,
  parseName,
} from "~/server/suppliers/esimaccess/parse-package-name";

describe("parseName", () => {
  test("parses the FUP speed from a daily plan", () => {
    expect(parseName("Japan 3GB/Day FUP1Mbps (IIJ)")?.fup).toEqual({
      value: 1,
      unit: "M",
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
