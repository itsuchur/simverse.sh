import { describe, expect, test } from "bun:test";

import { countryNameToIso } from "~/server/suppliers/esimfly/country-codes";

describe("countryNameToIso", () => {
  test("resolves Intl display names", () => {
    expect(countryNameToIso("United States")).toBe("US");
    expect(countryNameToIso("Germany")).toBe("DE");
    expect(countryNameToIso("Hong Kong SAR China")).toBe("HK");
  });

  test("resolves common aliases and short forms", () => {
    expect(countryNameToIso("USA")).toBe("US");
    expect(countryNameToIso("UK")).toBe("GB");
    expect(countryNameToIso("Hong Kong")).toBe("HK");
    expect(countryNameToIso("South Korea")).toBe("KR");
    expect(countryNameToIso("Czech Republic")).toBe("CZ");
    expect(countryNameToIso("Türkiye")).toBe("TR");
    expect(countryNameToIso("Trinidad & Tobago")).toBe("TT");
  });

  test("is case and whitespace insensitive", () => {
    expect(countryNameToIso("  united   kingdom ")).toBe("GB");
    expect(countryNameToIso("FRANCE")).toBe("FR");
  });

  test("passes through ISO codes", () => {
    expect(countryNameToIso("JP")).toBe("JP");
  });

  test("returns undefined for unknown names", () => {
    expect(countryNameToIso("Atlantis")).toBeUndefined();
    expect(countryNameToIso("Europe")).toBeUndefined();
    expect(countryNameToIso("")).toBeUndefined();
  });
});
