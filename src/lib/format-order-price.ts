import { STARS_PAYMENT_PROVIDER } from "~/lib/order-status";

export function isStarsOrderPrice(provider: string) {
  return provider === STARS_PAYMENT_PROVIDER;
}

/** Fiat `priceAmount` is stored in minor units (cents). Stars are whole units. */
export function orderPriceMajorUnits(amount: bigint) {
  return Number(amount) / 100;
}

export function formatOrderPrice(
  amount: bigint,
  currency: string,
  provider: string,
) {
  if (isStarsOrderPrice(provider)) {
    return `${amount.toString()} Stars`;
  }
  const major = orderPriceMajorUnits(amount);
  return `${major.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}
