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

const EN_COVERAGE_SUFFIX = /\s*\(\d+\+?\s+(?:areas|countries)\)\s*$/i;
const RU_COVERAGE_SUFFIX =
  /\s*\(\d+\+?\s+(?:направлен\p{L}*|стран\p{L}*)\)\s*$/iu;

const HIDDEN_LABELS = new Set(["asia-20", "aukus"]);

const RENAMES: Record<string, { en: string; ru: string }> = {
  gcc: { en: "Gulf Region", ru: "Страны Персидского залива" },
};

function canonicalRegionLabel(label: string): string {
  const stripped = label.replace(EN_COVERAGE_SUFFIX, "").trim();
  return stripped || label.trim();
}

function canonicalRegionLabelRu(
  nameRu: string | undefined,
): string | undefined {
  const label = nameRu?.split(" — ")[0]?.trim();
  if (!label) return undefined;
  const stripped = label.replace(RU_COVERAGE_SUFFIX, "").trim();
  return stripped || undefined;
}

function countryCount(location: string): number {
  return location.split(",").filter(Boolean).length;
}

function shapeKey(pkg: RegionalPackageSource): string {
  const parsed = parseName(pkg.name);
  const fup = parsed?.fup;
  return [
    pkg.duration,
    pkg.volume,
    parsed?.perDay ? "day" : "total",
    fup ? `${fup.value}${fup.unit}` : "",
  ].join("\0");
}

/** More countries, then the lower price, then a stable package code. */
function beats(
  candidate: RegionalPackageSource,
  current: RegionalPackageSource,
) {
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

function preferPlans<T extends RegionalPackageSource>(packages: T[]): T[] {
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
