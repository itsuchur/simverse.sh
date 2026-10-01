import "server-only";

import { db } from "~/server/db";

/** The fields an exclusion check needs; `location` is the supplier's comma-separated ISO list. */
export type ExcludablePackage = { packageCode: string; location: string };

export type PackageExclusions = {
  packageCodes: Set<string>;
  /** Hides single-country packages only (`location === countryCode`). */
  countryCodes: Set<string>;
};

function normalizeResellerCode(resellerCode: string) {
  return resellerCode.trim().toLowerCase();
}

function normalizePackageCode(packageCode: string) {
  return packageCode.trim();
}

function normalizeCountryCode(countryCode: string) {
  return countryCode.trim().toUpperCase();
}

export async function getPackageExclusions(
  resellerCode: string,
): Promise<PackageExclusions> {
  const normalizedResellerCode = normalizeResellerCode(resellerCode);
  const [codeRows, countryRows] = await Promise.all([
    db.excludedPackageCode.findMany({
      where: { resellerCode: normalizedResellerCode },
      select: { packageCode: true },
    }),
    db.excludedCountryCode.findMany({
      where: { resellerCode: normalizedResellerCode },
      select: { countryCode: true },
    }),
  ]);
  return {
    packageCodes: new Set(codeRows.map(({ packageCode }) => packageCode)),
    countryCodes: new Set(countryRows.map(({ countryCode }) => countryCode)),
  };
}

export function isExcluded(
  pkg: ExcludablePackage,
  exclusions: PackageExclusions,
) {
  return (
    exclusions.packageCodes.has(pkg.packageCode) ||
    exclusions.countryCodes.has(pkg.location)
  );
}

export function filterExcludedPackages<T extends ExcludablePackage>(
  packages: T[],
  exclusions: PackageExclusions,
): T[] {
  return packages.filter((pkg) => !isExcluded(pkg, exclusions));
}

/** DB-backed check for a single package (cart snapshots, package lookups). */
export async function isPackageExcluded(
  resellerCode: string,
  pkg: ExcludablePackage,
) {
  const normalizedResellerCode = normalizeResellerCode(resellerCode);
  const [codeRow, countryRow] = await Promise.all([
    db.excludedPackageCode.findUnique({
      where: {
        resellerCode_packageCode: {
          resellerCode: normalizedResellerCode,
          packageCode: normalizePackageCode(pkg.packageCode),
        },
      },
      select: { id: true },
    }),
    db.excludedCountryCode.findUnique({
      where: {
        resellerCode_countryCode: {
          resellerCode: normalizedResellerCode,
          countryCode: pkg.location,
        },
      },
      select: { id: true },
    }),
  ]);
  return codeRow !== null || countryRow !== null;
}

export async function excludePackageCode(
  resellerCode: string,
  packageCode: string,
) {
  const normalizedResellerCode = normalizeResellerCode(resellerCode);
  const normalizedPackageCode = normalizePackageCode(packageCode);

  return db.excludedPackageCode.upsert({
    where: {
      resellerCode_packageCode: {
        resellerCode: normalizedResellerCode,
        packageCode: normalizedPackageCode,
      },
    },
    create: {
      resellerCode: normalizedResellerCode,
      packageCode: normalizedPackageCode,
    },
    update: {},
  });
}

export async function restorePackageCode(
  resellerCode: string,
  packageCode: string,
) {
  return db.excludedPackageCode.deleteMany({
    where: {
      resellerCode: normalizeResellerCode(resellerCode),
      packageCode: normalizePackageCode(packageCode),
    },
  });
}

export async function excludeCountryCode(
  resellerCode: string,
  countryCode: string,
) {
  const normalizedResellerCode = normalizeResellerCode(resellerCode);
  const normalizedCountryCode = normalizeCountryCode(countryCode);

  return db.excludedCountryCode.upsert({
    where: {
      resellerCode_countryCode: {
        resellerCode: normalizedResellerCode,
        countryCode: normalizedCountryCode,
      },
    },
    create: {
      resellerCode: normalizedResellerCode,
      countryCode: normalizedCountryCode,
    },
    update: {},
  });
}

export async function restoreCountryCode(
  resellerCode: string,
  countryCode: string,
) {
  return db.excludedCountryCode.deleteMany({
    where: {
      resellerCode: normalizeResellerCode(resellerCode),
      countryCode: normalizeCountryCode(countryCode),
    },
  });
}
