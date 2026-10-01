import { beforeEach, describe, expect, test } from "bun:test";

import {
  excludeCountryCode,
  excludePackageCode,
  filterExcludedPackages,
  getPackageExclusions,
  isPackageExcluded,
  restoreCountryCode,
  restorePackageCode,
} from "~/server/catalog/package-exclusions";
import { fakeDb } from "~/test/fake-db";
import { resetTestState } from "~/test/mocks";

beforeEach(resetTestState);

const packages = [
  { packageCode: "PKG-1", location: "RU", name: "Russia" },
  { packageCode: "PKG-2", location: "RU,KZ", name: "Russia + Kazakhstan" },
  { packageCode: "PKG-3", location: "US", name: "USA" },
  { packageCode: "PKG-4", location: "RU,US,KZ,DE,FR", name: "Global" },
];

describe("package code exclusions", () => {
  test("adds a normalized, idempotent provider-scoped exclusion", async () => {
    await excludePackageCode(" ESIMACCESS ", " PKG-1 ");
    await excludePackageCode("esimaccess", "PKG-1");

    expect((await getPackageExclusions("esimaccess")).packageCodes).toEqual(
      new Set(["PKG-1"]),
    );
    expect(
      await fakeDb.excludedPackageCode.findMany({
        where: { resellerCode: "esimaccess" },
      }),
    ).toHaveLength(1);
    expect((await getPackageExclusions("other")).packageCodes).toEqual(
      new Set(),
    );
  });

  test("restores a code idempotently", async () => {
    await excludePackageCode("esimaccess", "PKG-1");

    expect(await restorePackageCode("esimaccess", "PKG-1")).toEqual({
      count: 1,
    });
    expect(await restorePackageCode("esimaccess", "PKG-1")).toEqual({
      count: 0,
    });
  });

  test("filters excluded codes without changing package order", () => {
    expect(
      filterExcludedPackages(packages, {
        packageCodes: new Set(["PKG-2"]),
        countryCodes: new Set(),
      }).map((pkg) => pkg.packageCode),
    ).toEqual(["PKG-1", "PKG-3", "PKG-4"]);
  });

  test("makes a newly excluded code unavailable to stale cart checks", async () => {
    const pkg = { packageCode: "PKG-1", location: "RU" };
    expect(await isPackageExcluded("esimaccess", pkg)).toBe(false);

    await excludePackageCode("esimaccess", "PKG-1");

    expect(await isPackageExcluded("esimaccess", pkg)).toBe(true);
  });
});

describe("country exclusions", () => {
  test("adds a normalized, idempotent provider-scoped exclusion", async () => {
    await excludeCountryCode(" ESIMACCESS ", " ru ");
    await excludeCountryCode("esimaccess", "RU");

    expect((await getPackageExclusions("esimaccess")).countryCodes).toEqual(
      new Set(["RU"]),
    );
    expect(
      await fakeDb.excludedCountryCode.findMany({
        where: { resellerCode: "esimaccess" },
      }),
    ).toHaveLength(1);
    expect((await getPackageExclusions("other")).countryCodes).toEqual(
      new Set(),
    );
  });

  test("restores a country idempotently", async () => {
    await excludeCountryCode("esimaccess", "RU");

    expect(await restoreCountryCode("esimaccess", "ru")).toEqual({ count: 1 });
    expect(await restoreCountryCode("esimaccess", "RU")).toEqual({ count: 0 });
  });

  test("hides single-country packages only, keeping regional and global bundles", () => {
    expect(
      filterExcludedPackages(packages, {
        packageCodes: new Set(),
        countryCodes: new Set(["RU"]),
      }).map((pkg) => pkg.packageCode),
    ).toEqual(["PKG-2", "PKG-3", "PKG-4"]);
  });

  test("combines code and country exclusions", () => {
    expect(
      filterExcludedPackages(packages, {
        packageCodes: new Set(["PKG-4"]),
        countryCodes: new Set(["US"]),
      }).map((pkg) => pkg.packageCode),
    ).toEqual(["PKG-1", "PKG-2"]);
  });

  test("makes a newly excluded country unavailable to stale cart checks", async () => {
    const single = { packageCode: "PKG-1", location: "RU" };
    const regional = { packageCode: "PKG-2", location: "RU,KZ" };
    expect(await isPackageExcluded("esimaccess", single)).toBe(false);

    await excludeCountryCode("esimaccess", "RU");

    expect(await isPackageExcluded("esimaccess", single)).toBe(true);
    expect(await isPackageExcluded("esimaccess", regional)).toBe(false);
  });
});
