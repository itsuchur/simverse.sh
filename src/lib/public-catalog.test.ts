import { describe, expect, test } from "bun:test";

import type { CatalogPackage } from "~/server/suppliers/esimaccess/catalog-types";

import {
  findCatalogPackage,
  formatVolume,
  plansCoveringCountry,
  sortPlans,
} from "./public-catalog";

function pkg(
  packageCode: string,
  location: string,
  duration = 7,
  volume = 1024 ** 3,
): CatalogPackage {
  return {
    packageCode,
    slug: packageCode.toLowerCase(),
    name: packageCode,
    isUnlimited: false,
    volume,
    duration,
    durationUnit: "DAY",
    location,
    priceUsd: 5,
    priceRub: 450,
    currencyCode: "USD",
  };
}

const catalog = {
  local: [
    {
      countryCode: "TR",
      countryName: "Türkiye",
      packages: [pkg("TR-1", "TR")],
    },
  ],
  regional: [
    {
      regionLabel: "Europe",
      regionLabelRu: "Европа",
      packages: [pkg("EU-1", "DE,TR"), pkg("EU-2", "DE,FR")],
    },
  ],
  global: [pkg("GL-1", "DE,TR,US")],
};

describe("public catalog helpers", () => {
  test("formats data volume", () => {
    expect(formatVolume(1024 ** 3)).toBe("1 GB");
    expect(formatVolume(1.5 * 1024 ** 3)).toBe("1.5 GB");
    expect(formatVolume(500 * 1024 ** 2)).toBe("500 MB");
  });

  test("sorts by validity then data", () => {
    const sorted = sortPlans([
      pkg("B", "TR", 7, 2),
      pkg("A", "TR", 1, 5),
      pkg("C", "TR", 7, 1),
    ]);
    expect(sorted.map((p) => p.packageCode)).toEqual(["A", "C", "B"]);
  });

  test("lists regional and global plans that include a country", () => {
    const groups = plansCoveringCountry(catalog, "TR", "ru", "Global");
    expect(
      groups.map((g) => [g.title, g.packages.map((p) => p.packageCode)]),
    ).toEqual([
      ["Европа", ["EU-1"]],
      ["Global", ["GL-1"]],
    ]);
  });

  test("finds a package in any scope", () => {
    expect(findCatalogPackage(catalog, "EU-2")?.location).toBe("DE,FR");
    expect(findCatalogPackage(catalog, "GL-1")?.packageCode).toBe("GL-1");
    expect(findCatalogPackage(catalog, "nope")).toBeUndefined();
  });
});
