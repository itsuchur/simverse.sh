import "server-only";

import { createHmac, randomUUID } from "node:crypto";

import { getRedis } from "~/server/redis";
import type {
  CatalogByScope,
  CatalogPackage,
  PopularCountryPackages,
  RegionPackages,
} from "~/server/suppliers/esimaccess/catalog-types";
import { parseName } from "~/server/suppliers/esimaccess/parse-package-name";

export type {
  CatalogByScope,
  CatalogPackage,
  PopularCountryPackages,
  RegionPackages,
} from "~/server/suppliers/esimaccess/catalog-types";

const ESIMACCESS_API_BASE = "https://api.esimaccess.com/api/v1/open";

export const ESIMACCESS_PACKAGES_REDIS_KEY = "esimaccess:packages";
export const POPULAR_COUNTRIES_REDIS_KEY = "popularCountries";

/** Supplier money amounts use 10000 = $1.00 (USD). */
export const ESIMACCESS_PRICE_SCALE = 10_000;

export type EsimAccessPackage = {
  packageCode: string;
  slug: string;
  name: string;
  /** Russian display name, precomputed by the poller (see localize.ts). */
  nameRu?: string;
  price: number;
  retailPrice: number;
  /** Customer-facing price in whole rubles, from retailPrice × USD/RUB. */
  priceRub?: number;
  currencyCode: string;
  volume: number;
  duration: number;
  durationUnit: string;
  location: string;
  speed?: string;
  supportTopUpType?: number;
  activeType?: number;
  locationNetworkList?: unknown[];
};

export type CachedEsimAccessPackages = {
  syncedAt: string;
  count: number;
  usdRubRate: number;
  usdRubRateDate: string;
  packageList: EsimAccessPackage[];
};

function extractNetworks(
  locationNetworkList: unknown[] | undefined,
): CatalogPackage["networks"] {
  if (!locationNetworkList?.length) {
    return undefined;
  }

  const seen = new Set<string>();
  const networks: NonNullable<CatalogPackage["networks"]> = [];

  for (const location of locationNetworkList) {
    if (!location || typeof location !== "object") continue;
    const operatorList = (location as { operatorList?: unknown }).operatorList;
    if (!Array.isArray(operatorList)) continue;

    for (const operator of operatorList) {
      if (!operator || typeof operator !== "object") continue;
      const name = (operator as { operatorName?: unknown }).operatorName;
      if (typeof name !== "string" || !name.trim()) continue;
      const operatorName = name.trim();
      if (seen.has(operatorName)) continue;
      seen.add(operatorName);
      networks.push({ operatorName });
    }
  }

  return networks.length > 0 ? networks : undefined;
}

function toCatalogPackage(pkg: EsimAccessPackage): CatalogPackage {
  return {
    packageCode: pkg.packageCode,
    slug: pkg.slug,
    name: pkg.name,
    nameRu: pkg.nameRu,
    volume: pkg.volume,
    duration: pkg.duration,
    durationUnit: pkg.durationUnit,
    location: pkg.location,
    priceRub: pkg.priceRub,
    currencyCode: pkg.currencyCode,
    networks: extractNetworks(pkg.locationNetworkList),
  };
}

type EsimAccessPackageListResponse = {
  success: boolean;
  errorCode?: string;
  errorMsg?: string | null;
  obj?: {
    packageList?: EsimAccessPackage[];
  };
};

function getAccessCode() {
  const accessCode = process.env.ESIMACCESS_ACCESS_CODE;
  if (!accessCode) {
    throw new Error("ESIMACCESS_ACCESS_CODE is not set");
  }
  return accessCode;
}

function buildSignedHeaders(accessCode: string, body: string) {
  const timestamp = Date.now().toString();
  const requestId = randomUUID();
  const signString = `${timestamp}${requestId}${accessCode}${body}`;
  const signature = createHmac("sha256", accessCode)
    .update(signString)
    .digest("hex")
    .toLowerCase();

  return {
    "Content-Type": "application/json",
    "RT-AccessCode": accessCode,
    "RT-Timestamp": timestamp,
    "RT-RequestID": requestId,
    "RT-Signature": signature,
  };
}

export async function fetchEsimAccessPackages() {
  // Empty filters return the full catalog.
  const body = JSON.stringify({});
  const response = await fetch(`${ESIMACCESS_API_BASE}/package/list`, {
    method: "POST",
    headers: buildSignedHeaders(getAccessCode(), body),
    body,
  });

  if (!response.ok) {
    throw new Error(
      `eSIM Access package/list failed: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const payload = (await response.json()) as EsimAccessPackageListResponse;

  if (!payload.success) {
    throw new Error(
      `eSIM Access package/list error: ${payload.errorCode ?? "unknown"} ${payload.errorMsg ?? ""}`.trim(),
    );
  }

  return payload.obj?.packageList ?? [];
}

const FRANKFURTER_USD_RUB_URL = "https://api.frankfurter.dev/v2/rate/USD/RUB";

type FrankfurterRateResponse = {
  base: string;
  quote: string;
  rate: number;
  date: string;
};

export async function fetchUsdRubRate() {
  const response = await fetch(FRANKFURTER_USD_RUB_URL);

  if (!response.ok) {
    throw new Error(
      `Frankfurter USD/RUB rate failed: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const payload = (await response.json()) as FrankfurterRateResponse;

  if (
    payload.base !== "USD" ||
    payload.quote !== "RUB" ||
    typeof payload.rate !== "number" ||
    !Number.isFinite(payload.rate) ||
    payload.rate <= 0
  ) {
    throw new Error("Frankfurter USD/RUB rate response was invalid");
  }

  return { rate: payload.rate, date: payload.date };
}

/** retailPrice is USD with scale 10000 = $1; returns whole rubles. */
export function retailPriceToRub(
  retailPrice: number,
  usdRubRate: number,
): number {
  return Math.round((retailPrice / ESIMACCESS_PRICE_SCALE) * usdRubRate);
}

export function withPriceRub(
  packages: EsimAccessPackage[],
  usdRubRate: number,
): EsimAccessPackage[] {
  return packages.map((pkg) => ({
    ...pkg,
    priceRub: retailPriceToRub(pkg.retailPrice, usdRubRate),
  }));
}

export async function getCachedEsimAccessPackages() {
  const redis = await getRedis();
  const raw = await redis.get(ESIMACCESS_PACKAGES_REDIS_KEY);
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as CachedEsimAccessPackages;
}

export async function getPopularCountryCodes() {
  const redis = await getRedis();
  return redis.lRange(POPULAR_COUNTRIES_REDIS_KEY, 0, -1);
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

/** Single-country packages whose `location` is listed in `popularCountries`. */
export async function getPopularPackagesByCountry(
  locale: string,
): Promise<PopularCountryPackages[]> {
  const [countryCodes, cached] = await Promise.all([
    getPopularCountryCodes(),
    getCachedEsimAccessPackages(),
  ]);
  const packageList = cached?.packageList ?? [];

  return countryCodes.map((countryCode) => ({
    countryCode,
    countryName: countryDisplayName(countryCode, locale),
    packages: packageList
      .filter((pkg) => pkg.location === countryCode)
      .map(toCatalogPackage),
  }));
}

const GLOBAL_COUNTRY_THRESHOLD = 90;

/** The Russian region label is the part of `nameRu` before the em dash. */
function regionLabelRu(pkg: EsimAccessPackage): string | undefined {
  return pkg.nameRu?.split(" — ")[0];
}

/**
 * Splits the full catalog by coverage: single-country packages grouped by
 * country, multi-country ones grouped by region label, and worldwide ones
 * (90+ countries) as a flat list.
 */
export async function getCatalogByScope(
  locale: string,
): Promise<CatalogByScope> {
  const cached = await getCachedEsimAccessPackages();
  const packageList = cached?.packageList ?? [];

  const byCountry = new Map<string, CatalogPackage[]>();
  const byRegion = new Map<string, RegionPackages>();
  const global: CatalogPackage[] = [];

  for (const pkg of packageList) {
    const countryCount = pkg.location.split(",").filter(Boolean).length;

    if (countryCount === 1) {
      const packages = byCountry.get(pkg.location) ?? [];
      packages.push(toCatalogPackage(pkg));
      byCountry.set(pkg.location, packages);
    } else if (countryCount < GLOBAL_COUNTRY_THRESHOLD) {
      const label = parseName(pkg.name)?.label ?? pkg.name;
      const group = byRegion.get(label) ?? {
        regionLabel: label,
        regionLabelRu: regionLabelRu(pkg),
        packages: [],
      };
      group.packages.push(toCatalogPackage(pkg));
      byRegion.set(label, group);
    } else {
      global.push(toCatalogPackage(pkg));
    }
  }

  const local: PopularCountryPackages[] = [...byCountry.entries()]
    .map(([countryCode, packages]) => ({
      countryCode,
      countryName: countryDisplayName(countryCode, locale),
      packages,
    }))
    .sort((a, b) => a.countryName.localeCompare(b.countryName, locale));

  const regional = [...byRegion.values()].sort((a, b) =>
    a.regionLabel.localeCompare(b.regionLabel),
  );

  return { local, regional, global };
}
