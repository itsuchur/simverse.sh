import "server-only";

import type {
  ESIMfly,
  ListAllPackagesOptions,
  Package as EsimflyApiPackage,
} from "@esimfly/sdk";

import { writeCatalogGeneration } from "~/server/catalog/store";
import { countryNameToIso } from "~/server/suppliers/esimfly/country-codes";

export const ESIMFLY_SUPPLIER = "esimfly";

const GB = 1024 ** 3;
const ISO_COUNTRY_CODE = /^[A-Z]{2}$/;

/** Normalized eSIMfly package as stored in the RedisJSON catalog. */
export type EsimflyPackage = {
  /** Opaque supplier code; stored verbatim. */
  packageCode: string;
  name: string;
  /** Russian display name, precomputed by the poller (see localize.ts). */
  nameRu?: string;
  /** Supplier's region/country label, e.g. "United States" or "Europe". */
  region: string;
  type: string;
  /** Sorted, comma-joined ISO alpha-2 codes covered by the package. */
  location: string;
  /** Bytes, from `data_amount_gb`. */
  volume: number;
  duration: number;
  durationUnit: "DAY";
  /** Supplier buy price in `currency`; no customer price is derived yet. */
  cost: number;
  currency: string;
  isUnlimited: boolean;
  features: {
    voiceMinutes: number;
    smsCount: number;
    isRechargeable: boolean;
  };
  provider?: string;
  networkCarrier?: string;
  locationNetworkList?: unknown[];
};

export type EsimflyCatalogMeta = {
  syncedAt: string;
  count: number;
  currency: string;
};

function isoCodes(values: unknown[] | undefined): string[] {
  const codes = new Set<string>();
  for (const value of values ?? []) {
    if (typeof value !== "string") continue;
    const code = value.trim().toUpperCase();
    if (ISO_COUNTRY_CODE.test(code)) codes.add(code);
  }
  return [...codes].sort();
}

export type ResolvedLocation = {
  codes: string[];
  /** Location names that could not be mapped to an ISO code. */
  unresolved: string[];
};

/**
 * Coverage is taken from `countries` when the supplier provides it, then from
 * `networks[].country_iso2`, and finally from `locationNetworkList[]`
 * location names mapped to ISO codes.
 */
export function resolveLocation(pkg: EsimflyApiPackage): ResolvedLocation {
  const fromCountries = isoCodes(pkg.countries);
  if (fromCountries.length > 0) {
    return { codes: fromCountries, unresolved: [] };
  }

  const fromNetworks = isoCodes(
    pkg.networks?.map((network) => network.country_iso2),
  );
  if (fromNetworks.length > 0) {
    return { codes: fromNetworks, unresolved: [] };
  }

  const codes = new Set<string>();
  const unresolved: string[] = [];
  for (const location of pkg.locationNetworkList ?? []) {
    const name = location?.locationName;
    if (typeof name !== "string" || !name.trim()) continue;
    const code = countryNameToIso(name);
    if (code) {
      codes.add(code);
    } else {
      unresolved.push(name.trim());
    }
  }
  return { codes: [...codes].sort(), unresolved };
}

export function toEsimflyPackage(
  pkg: EsimflyApiPackage,
  codes: string[],
): EsimflyPackage {
  return {
    packageCode: pkg.package_code,
    name: pkg.name,
    region: pkg.region,
    type: pkg.type,
    location: codes.join(","),
    volume: Math.round((pkg.data_amount_gb ?? 0) * GB),
    duration: pkg.validity_days,
    durationUnit: "DAY",
    cost: pkg.cost,
    currency: pkg.currency,
    isUnlimited: Boolean(pkg.is_unlimited),
    features: {
      voiceMinutes: pkg.features?.voice_minutes ?? 0,
      smsCount: pkg.features?.sms_count ?? 0,
      isRechargeable: pkg.features?.is_rechargeable ?? false,
    },
    provider: pkg.provider,
    networkCarrier: pkg.network_carrier ?? undefined,
    locationNetworkList: pkg.locationNetworkList,
  };
}

export type NormalizedEsimflyPackages = {
  packages: EsimflyPackage[];
  /** Packages dropped because no country code could be resolved. */
  skipped: EsimflyApiPackage[];
  /** Distinct location names that could not be mapped to ISO codes. */
  unresolvedNames: string[];
};

export function normalizeEsimflyPackages(
  raw: EsimflyApiPackage[],
): NormalizedEsimflyPackages {
  const packages: EsimflyPackage[] = [];
  const skipped: EsimflyApiPackage[] = [];
  const unresolved = new Set<string>();

  for (const pkg of raw) {
    const location = resolveLocation(pkg);
    for (const name of location.unresolved) unresolved.add(name);
    if (location.codes.length === 0) {
      skipped.push(pkg);
      continue;
    }
    packages.push(toEsimflyPackage(pkg, location.codes));
  }

  return { packages, skipped, unresolvedNames: [...unresolved].sort() };
}

/**
 * Pages through the whole catalog (`limit=100`, paced at 1 req/s by the SDK).
 * Throws on the first failed page so a partial catalog is never written.
 */
export async function fetchEsimflyPackages(
  client: ESIMfly,
  options?: ListAllPackagesOptions,
): Promise<EsimflyApiPackage[]> {
  const all: EsimflyApiPackage[] = [];
  await client.packages.sync(
    (packages) => {
      all.push(...packages);
    },
    { limit: 100, ...options },
  );
  return all;
}

function countryDisplayName(countryCode: string, locale: string) {
  try {
    return (
      new Intl.DisplayNames([locale], { type: "region" }).of(countryCode) ??
      countryCode
    );
  } catch {
    return countryCode;
  }
}

/** The Russian region label is the part of `nameRu` before the em dash. */
function regionLabelRu(pkg: EsimflyPackage): string | undefined {
  return pkg.nameRu?.split(" — ")[0];
}

/**
 * Everything a customer might type to find this package: names in both
 * languages, country/region display labels, and the ISO country codes.
 */
export function buildSearchText(pkg: EsimflyPackage): string {
  const codes = pkg.location.split(",").filter(Boolean);
  const parts: (string | undefined)[] = [
    pkg.name,
    pkg.nameRu,
    pkg.region,
    ...codes,
  ];

  if (codes.length === 1 && codes[0]) {
    parts.push(
      countryDisplayName(codes[0], "en"),
      countryDisplayName(codes[0], "ru"),
    );
  } else {
    parts.push(regionLabelRu(pkg));
  }

  return [...new Set(parts.filter(Boolean))].join(" ");
}

/** Writes the catalog as one RedisJSON document per package (see store.ts). */
export async function writeEsimflyCatalog(
  meta: EsimflyCatalogMeta,
  packageList: EsimflyPackage[],
) {
  return writeCatalogGeneration(
    ESIMFLY_SUPPLIER,
    meta,
    packageList.map((pkg) => ({ ...pkg, searchText: buildSearchText(pkg) })),
  );
}
