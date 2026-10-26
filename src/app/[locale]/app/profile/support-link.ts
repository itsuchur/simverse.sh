const SUPPORT_URL = "https://t.me/simversesupport";

/** Opens the support chat with the user's Telegram ID prefilled in the composer. */
export function supportTelegramHref(
  telegramId: string | null | undefined,
): string {
  if (!telegramId) return SUPPORT_URL;
  return `${SUPPORT_URL}?text=${encodeURIComponent(`Telegram ID: ${telegramId}`)}`;
}
