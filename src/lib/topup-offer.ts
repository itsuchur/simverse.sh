export type TopupPackageOffer = {
  packageCode: string;
  name: string;
  volumeBytes: number;
  validityDays: number;
  priceUsd: number;
  priceRub: number;
  priceStars: number;
};

export type TopupOffers =
  | { mode: "none" }
  | { mode: "packages"; packages: TopupPackageOffer[] }
  | {
      mode: "validity";
      days: number;
      priceUsd: number;
      priceRub: number;
      priceStars: number;
    };
