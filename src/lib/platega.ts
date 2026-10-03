export const PLATEGA_SBP_DISCOUNT_PERCENT = 5;

export function discountedSbpCents(amount: number) {
  return Math.round(amount * 100 * (1 - PLATEGA_SBP_DISCOUNT_PERCENT / 100));
}
