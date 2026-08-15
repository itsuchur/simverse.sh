import type { EsimAccessPackage } from "~/server/suppliers/esimaccess/packages";
import { parseName } from "~/server/suppliers/esimaccess/parse-package-name";

function isPremium(name: string) {
  return /\bPremium\b/i.test(name);
}

function isNonhkip(name: string) {
  return /\(nonhkip\)/i.test(name);
}

function isFup(name: string) {
  return parseName(name)?.fup != null || /FUP\d+[KM]bps/i.test(name);
}

function shapeKey(pkg: EsimAccessPackage) {
  return `${pkg.volume}\0${pkg.duration}\0${pkg.durationUnit}`;
}

function dropFupIfTwin(packages: EsimAccessPackage[]) {
  const byShape = new Map<string, EsimAccessPackage[]>();
  for (const pkg of packages) {
    const list = byShape.get(shapeKey(pkg)) ?? [];
    list.push(pkg);
    byShape.set(shapeKey(pkg), list);
  }

  const keep = new Set<string>();
  for (const group of byShape.values()) {
    const hasNonFup = group.some((pkg) => !isFup(pkg.name));
    for (const pkg of group) {
      if (!hasNonFup || !isFup(pkg.name)) {
        keep.add(pkg.packageCode);
      }
    }
  }

  return packages.filter((pkg) => keep.has(pkg.packageCode));
}

function preferLocationGroup(packages: EsimAccessPackage[]) {
  let kept = packages;

  if (kept.some((pkg) => isNonhkip(pkg.name))) {
    kept = kept.filter((pkg) => isNonhkip(pkg.name));
  }

  if (kept.some((pkg) => isPremium(pkg.name))) {
    kept = kept.filter((pkg) => isPremium(pkg.name));
  }

  return dropFupIfTwin(kept);
}

/** Drop confusing SKU twins before the catalog is written to Redis. */
export function preferCatalogPackages(packages: EsimAccessPackage[]) {
  const byLocation = new Map<string, EsimAccessPackage[]>();
  for (const pkg of packages) {
    const list = byLocation.get(pkg.location) ?? [];
    list.push(pkg);
    byLocation.set(pkg.location, list);
  }

  const keep = new Set<string>();
  for (const group of byLocation.values()) {
    for (const pkg of preferLocationGroup(group)) {
      keep.add(pkg.packageCode);
    }
  }

  return packages.filter((pkg) => keep.has(pkg.packageCode));
}
