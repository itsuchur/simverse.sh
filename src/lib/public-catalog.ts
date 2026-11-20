import type {
  CatalogByScope,
  CatalogPackage,
  PopularCountryPackages,
} from "~/server/suppliers/esimaccess/catalog-types";

/** A titled group of packages on a public catalog page. */
export type PlanGroup = {
  id: string;
  title: string;
  packages: CatalogPackage[];
};

export function formatVolume(bytes: number) {
  const gib = bytes / 1024 ** 3;
  if (gib >= 1) {
    return Number.isInteger(gib) ? `${gib} GB` : `${gib.toFixed(1)} GB`;
  }
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

/** Shortest validity first, then smallest data allowance. */
export function sortPlans(packages: readonly CatalogPackage[]) {
  return [...packages].sort(
    (a, b) => a.duration - b.duration || a.volume - b.volume,
  );
}

function regionTitle(
  group: { regionLabel: string; regionLabelRu?: string },
  locale: string,
) {
  return locale === "ru" && group.regionLabelRu
    ? group.regionLabelRu
    : group.regionLabel;
}

export function regionalGroups(
  catalog: CatalogByScope,
  locale: string,
): PlanGroup[] {
  return catalog.regional
    .map((group) => ({
      id: group.regionLabel,
      title: regionTitle(group, locale),
      packages: sortPlans(group.packages),
    }))
    .sort((a, b) => a.title.localeCompare(b.title, locale));
}

function coversCountry(pkg: CatalogPackage, countryCode: string) {
  return pkg.location.split(",").some((code) => code.trim() === countryCode);
}

/** Regional and global packages that include the country, grouped by region. */
export function plansCoveringCountry(
  catalog: CatalogByScope,
  countryCode: string,
  locale: string,
  globalTitle: string,
): PlanGroup[] {
  const regional = regionalGroups(catalog, locale)
    .map((group) => ({
      ...group,
      packages: group.packages.filter((pkg) => coversCountry(pkg, countryCode)),
    }))
    .filter((group) => group.packages.length > 0);
  const global = sortPlans(
    catalog.global.filter((pkg) => coversCountry(pkg, countryCode)),
  );
  return global.length > 0
    ? [...regional, { id: "global", title: globalTitle, packages: global }]
    : regional;
}

export function countriesWithPlans(
  catalog: CatalogByScope,
): PopularCountryPackages[] {
  return catalog.local.filter((group) => group.packages.length > 0);
}

export function findCatalogPackage(
  catalog: CatalogByScope,
  packageCode: string,
): CatalogPackage | undefined {
  for (const group of catalog.local) {
    const pkg = group.packages.find((p) => p.packageCode === packageCode);
    if (pkg) return pkg;
  }
  for (const group of catalog.regional) {
    const pkg = group.packages.find((p) => p.packageCode === packageCode);
    if (pkg) return pkg;
  }
  return catalog.global.find((pkg) => pkg.packageCode === packageCode);
}
