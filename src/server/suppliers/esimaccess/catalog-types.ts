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
};

export type PopularCountryPackages = {
  countryCode: string;
  countryName: string;
  packages: CatalogPackage[];
};
