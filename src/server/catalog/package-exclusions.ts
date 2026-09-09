import "server-only";

import { db } from "~/server/db";

export type PackageWithCode = { packageCode: string };

function normalizeResellerCode(resellerCode: string) {
  return resellerCode.trim().toLowerCase();
}

function normalizePackageCode(packageCode: string) {
  return packageCode.trim();
}

export async function getExcludedPackageCodes(
  resellerCode: string,
): Promise<Set<string>> {
  const rows = await db.excludedPackageCode.findMany({
    where: { resellerCode: normalizeResellerCode(resellerCode) },
    select: { packageCode: true },
  });
  return new Set(rows.map(({ packageCode }) => packageCode));
}

export async function isPackageCodeExcluded(
  resellerCode: string,
  packageCode: string,
) {
  const row = await db.excludedPackageCode.findUnique({
    where: {
      resellerCode_packageCode: {
        resellerCode: normalizeResellerCode(resellerCode),
        packageCode: normalizePackageCode(packageCode),
      },
    },
    select: { id: true },
  });
  return row !== null;
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

export function filterExcludedPackages<T extends PackageWithCode>(
  packages: T[],
  excludedCodes: ReadonlySet<string>,
): T[] {
  return packages.filter((pkg) => !excludedCodes.has(pkg.packageCode));
}
