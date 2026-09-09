import { beforeEach, describe, expect, test } from "bun:test";

import {
  excludePackageCode,
  filterExcludedPackages,
  getExcludedPackageCodes,
  isPackageCodeExcluded,
  restorePackageCode,
} from "~/server/catalog/package-exclusions";
import { fakeDb } from "~/test/fake-db";
import { resetTestState } from "~/test/mocks";

beforeEach(resetTestState);

describe("package code exclusions", () => {
  test("adds a normalized, idempotent provider-scoped exclusion", async () => {
    await excludePackageCode(" ESIMACCESS ", " PKG-1 ");
    await excludePackageCode("esimaccess", "PKG-1");

    expect(await getExcludedPackageCodes("esimaccess")).toEqual(
      new Set(["PKG-1"]),
    );
    expect(
      await fakeDb.excludedPackageCode.findMany({
        where: { resellerCode: "esimaccess" },
      }),
    ).toHaveLength(1);
    expect(await getExcludedPackageCodes("other")).toEqual(new Set());
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
    const packages = [
      { packageCode: "PKG-1", name: "One" },
      { packageCode: "PKG-2", name: "Two" },
      { packageCode: "PKG-3", name: "Three" },
    ];

    expect(filterExcludedPackages(packages, new Set(["PKG-2"]))).toEqual([
      packages[0],
      packages[2],
    ]);
  });

  test("makes a newly excluded code unavailable to stale cart checks", async () => {
    expect(await isPackageCodeExcluded("esimaccess", "PKG-1")).toBe(false);

    await excludePackageCode("esimaccess", "PKG-1");

    expect(await isPackageCodeExcluded("esimaccess", "PKG-1")).toBe(true);
  });
});
