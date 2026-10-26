/** Provider amount we pay to provision a package. Customer markup is not part of this. */
export const SUPPLIER_PROVISION_COST_LIMIT_USD = 100;

/** True when a dollar amount is $100 or more. Non-finite amounts are left alone. */
export function exceedsUsdProvisionCost(usd: number): boolean {
  return (
    Number.isFinite(usd) && usd >= SUPPLIER_PROVISION_COST_LIMIT_USD
  );
}

/**
 * True when a scaled supplier amount is $100 or more.
 * eSIM Access uses `scale` 10000 = $1.
 */
export function exceedsScaledProvisionCost(
  scaled: number,
  scale: number,
): boolean {
  return (
    Number.isFinite(scaled) &&
    Number.isFinite(scale) &&
    scale > 0 &&
    scaled >= SUPPLIER_PROVISION_COST_LIMIT_USD * scale
  );
}
