export type TopupPackageOffer = {
  packageCode: string;
  name: string;
  volumeBytes: number;
  validityDays: number;
  priceUsd: number;
  priceRub: number;
  priceStars: number;
  /** Day-pass periodNum. Present for validity presets; omitted for data TOPUP_* packages. */
  days?: number;
};

export type TopupOffers =
  | { mode: "none" }
  | {
      mode: "packages";
      action: "extend" | "topup";
      packages: TopupPackageOffer[];
    };

/** Fixed day-pass extension lengths shown in the Extend dropdown. */
export const DAY_PASS_PRESETS = [1, 3, 7, 15, 30] as const;

export type DayPassPreset = (typeof DAY_PASS_PRESETS)[number];

export function isDayPassPreset(days: number): days is DayPassPreset {
  return (DAY_PASS_PRESETS as readonly number[]).includes(days);
}

/** Stable UI / checkout key when several presets share one packageCode. */
export function topupOfferKey(offer: TopupPackageOffer): string {
  return offer.days !== undefined
    ? `${offer.packageCode}:${offer.days}`
    : offer.packageCode;
}
