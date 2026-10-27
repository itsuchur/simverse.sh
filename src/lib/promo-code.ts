/** Uppercase letters and digits only. Shared by the checkout field and the server. */
export const PROMO_CODE_PATTERN = /^[A-Z0-9]{4,32}$/;

/** Trim and uppercase. Returns null when the value contains anything else. */
export function parsePromoCode(value: string): string | null {
  const code = value.trim().toUpperCase();
  if (!PROMO_CODE_PATTERN.test(code)) return null;
  return code;
}

/** Undefined when omitted or blank. Null when present but not a promo code. */
export function readPromoCode(
  value: string | undefined,
): string | null | undefined {
  if (value == null || value.trim() === "") return undefined;
  return parsePromoCode(value);
}

/**
 * Percent off a minor-unit price. Integer division keeps the remainder.
 * Returns null when the discount would not change the price or would charge 0.
 */
export function discountMinor(list: bigint, percent: number): bigint | null {
  if (!Number.isInteger(percent) || percent < 1 || percent > 99) return null;
  if (list < 1n) return null;
  const charged = list - (list * BigInt(percent)) / 100n;
  if (charged < 1n || charged >= list) return null;
  return charged;
}

/** Same minor-unit rounding the checkout routes use for RUB and USD. */
export function majorToMinor(major: number): bigint | null {
  const minor = Math.round(major * 100);
  if (!Number.isFinite(minor) || minor < 1) return null;
  return BigInt(minor);
}
