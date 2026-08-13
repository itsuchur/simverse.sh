// https://coindataflow.com/en/telegram-stars-to-ton

/** 1 Telegram Star = $0.030 USD. */
export const USD_PER_STAR = 0.03;

/** `usd` is a dollar amount (e.g. retailPrice / 10000). Whole Stars, rounded up. */
export function usdToStars(usd: number): number {
  return Math.ceil(usd / USD_PER_STAR);
}
