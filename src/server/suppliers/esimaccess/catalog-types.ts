/** Slim carrier entry for storefront network lists. */
export type CatalogNetwork = {
  operatorName: string;
};

/** Fields needed to render the store catalog. */
export type CatalogPackage = {
  packageCode: string;
  slug: string;
  name: string;
  /** Russian display name, precomputed by the poller. */
  nameRu?: string;
  volume: number;
  duration: number;
  durationUnit: string;
  location: string;
  priceRub?: number;
  currencyCode: string;
  /** Unique operators from the supplier locationNetworkList. */
  networks?: CatalogNetwork[];
};

export type PopularCountryPackages = {
  countryCode: string;
  countryName: string;
  packages: CatalogPackage[];
};

/** Multi-country packages sharing one region label, e.g. "Europe (35 areas)". */
export type RegionPackages = {
  regionLabel: string;
  regionLabelRu?: string;
  packages: CatalogPackage[];
};

export type CatalogByScope = {
  /** Single-country packages, grouped by country. */
  local: PopularCountryPackages[];
  /** 2–89 countries, grouped by region label. */
  regional: RegionPackages[];
  /** 90+ countries, flat. */
  global: CatalogPackage[];
};
