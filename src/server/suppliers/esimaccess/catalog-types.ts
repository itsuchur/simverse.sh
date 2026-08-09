/** Fields needed to render the store catalog. */
export type CatalogPackage = {
  packageCode: string;
  slug: string;
  name: string;
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
