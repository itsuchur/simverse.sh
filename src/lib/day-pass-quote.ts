/** Published eSIM Access day-pass discounts, by extension length. */
const DAY_PASS_DISCOUNTS = [
  { maxDays: 4, rate: 0.04 },
  { maxDays: 9, rate: 0.08 },
  { maxDays: 19, rate: 0.11 },
  { maxDays: 29, rate: 0.15 },
  { maxDays: 365, rate: 0.18 },
] as const;

export function dayPassDiscount(days: number): number | null {
  if (!Number.isInteger(days) || days < 1 || days > 365) return null;
  return DAY_PASS_DISCOUNTS.find((tier) => days <= tier.maxDays)?.rate ?? null;
}

/**
 * Supplier amount (10000 = $1) for extending a day-pass plan.
 * The purchased package price is discounted for its own duration; this undoes
 * that discount, then applies the discount for the extension length.
 */
export function quoteDayPassAmount(input: {
  retailPrice: number;
  durationDays: number;
  extendDays: number;
}): number | null {
  const baseDiscount = dayPassDiscount(input.durationDays);
  const extendDiscount = dayPassDiscount(input.extendDays);
  if (
    baseDiscount === null ||
    extendDiscount === null ||
    !Number.isFinite(input.retailPrice) ||
    input.retailPrice <= 0
  ) {
    return null;
  }

  const daily = input.retailPrice / (input.durationDays * (1 - baseDiscount));
  const amount = Math.round(daily * input.extendDays * (1 - extendDiscount));
  if (!Number.isFinite(amount) || amount < 1) return null;
  return amount;
}
