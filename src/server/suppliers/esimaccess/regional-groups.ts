import { parseName } from "~/server/suppliers/esimaccess/parse-package-name";

/** Fields needed to collapse multi-country packages into one row per place. */
export type RegionalPackageSource = {
  packageCode: string;
  name: string;
  nameRu?: string;
  volume: number;
  duration: number;
  retailPrice: number;
  location: string;
};

export type RegionalGroup<T extends RegionalPackageSource> = {
  regionLabel: string;
  regionLabelRu?: string;
  packages: T[];
};

const HIDDEN_LABELS = new Set(["asia-20", "aukus"]);

const RENAMES: Record<string, { en: string; ru: string }> = {
  gcc: { en: "Gulf Region", ru: "Страны Персидского залива" },
};

function tidyLabel(label: string): string {
  return label.replace(/\s{2,}/g, " ").trim();
}

function canonicalRegionLabel(label: string): string {
  const stripped = tidyLabel(
    label.replace(/\s*\(\d+\+?\s+(?:areas|countries)\)/gi, ""),
  );
  return stripped || label.trim();
}

function canonicalRegionLabelRu(
  nameRu: string | undefined,
): string | undefined {
  const label = nameRu?.split(" — ")[0]?.trim();
  if (!label) return undefined;
  const stripped = tidyLabel(
    label.replace(/\s*\(\d+\+?\s+(?:направлен\p{L}*|стран\p{L}*)\)/giu, ""),
  );
  return stripped || undefined;
}

function countryCount(location: string): number {
  return location.split(",").filter(Boolean).length;
}

function isThrottled(name: string) {
  return parseName(name)?.fup != null || /FUP\d+[KM]bps/i.test(name);
}

/** The button shows only duration and byte volume, so that is the identity. */
function shapeKey(pkg: RegionalPackageSource): string {
  return `${pkg.duration}\0${pkg.volume}`;
}

/**
 * Full-speed over throttled, then more countries, then the lower price,
 * then a stable package code.
 */
function beats(
  candidate: RegionalPackageSource,
  current: RegionalPackageSource,
) {
  const candidateThrottled = isThrottled(candidate.name);
  const currentThrottled = isThrottled(current.name);
  if (candidateThrottled !== currentThrottled) {
    return !candidateThrottled;
  }
  const candidateCountries = countryCount(candidate.location);
  const currentCountries = countryCount(current.location);
  if (candidateCountries !== currentCountries) {
    return candidateCountries > currentCountries;
  }
  if (candidate.retailPrice !== current.retailPrice) {
    return candidate.retailPrice < current.retailPrice;
  }
  return candidate.packageCode < current.packageCode;
}

/** One plan per visible size inside a single destination. */
export function preferPlans<T extends RegionalPackageSource>(
  packages: T[],
): T[] {
  const byShape = new Map<string, T>();
  for (const pkg of packages) {
    const current = byShape.get(shapeKey(pkg));
    if (!current || beats(pkg, current)) {
      byShape.set(shapeKey(pkg), pkg);
    }
  }
  return [...byShape.values()];
}

type GroupBuilder<T extends RegionalPackageSource> = {
  regionLabel: string;
  regionLabelRu?: string;
  ruSourceLength: number;
  packages: T[];
};

/**
 * Collapses supplier product lines such as "Europe (35 areas)" into one
 * region, drops junk labels, and keeps a single plan per visible size.
 */
export function groupRegionalPackages<T extends RegionalPackageSource>(
  packages: T[],
): RegionalGroup<T>[] {
  const byRegion = new Map<string, GroupBuilder<T>>();

  for (const pkg of packages) {
    const rawLabel = parseName(pkg.name)?.label ?? pkg.name;
    const canonical = canonicalRegionLabel(rawLabel);
    if (HIDDEN_LABELS.has(canonical.toLowerCase())) continue;

    const renamed = RENAMES[canonical.toLowerCase()];
    const regionLabel = renamed?.en ?? canonical;
    const key = regionLabel.toLowerCase();
    const regionLabelRu = renamed?.ru ?? canonicalRegionLabelRu(pkg.nameRu);
    const group = byRegion.get(key) ?? {
      regionLabel,
      ruSourceLength: Number.POSITIVE_INFINITY,
      packages: [],
    };

    if (regionLabelRu && (renamed || rawLabel.length < group.ruSourceLength)) {
      group.regionLabelRu = regionLabelRu;
      group.ruSourceLength = renamed ? 0 : rawLabel.length;
    }

    group.packages.push(pkg);
    byRegion.set(key, group);
  }

  return [...byRegion.values()]
    .map(({ regionLabel, regionLabelRu, packages: groupPackages }) => ({
      regionLabel,
      regionLabelRu,
      packages: preferPlans(groupPackages),
    }))
    .sort((a, b) => a.regionLabel.localeCompare(b.regionLabel));
}
