/** Telegram users get a synthetic `{telegramId}@telegram.local` address. */
export const TELEGRAM_EMAIL_SUFFIX = "@telegram.local";

export type BuyerContact = {
  telegramId: string | null;
  email: string;
  emailVerified: boolean;
  isBanned: boolean;
  isDeleted: boolean;
};

/**
 * Where buyer notices go: the Telegram chat when the user signed in with
 * Telegram, otherwise their verified email. Banned and deleted users get none.
 */
export function buyerChannel(
  user: BuyerContact,
): { kind: "telegram"; chatId: number } | { kind: "email"; to: string } | null {
  if (user.isBanned || user.isDeleted) return null;

  if (user.telegramId) {
    const chatId = Number(user.telegramId);
    return Number.isSafeInteger(chatId) && chatId > 0
      ? { kind: "telegram", chatId }
      : null;
  }

  const email = user.email.trim().toLowerCase();
  if (!user.emailVerified || email.endsWith(TELEGRAM_EMAIL_SUFFIX)) {
    return null;
  }
  return { kind: "email", to: email };
}

export const buyerContactSelect = {
  telegramId: true,
  email: true,
  emailVerified: true,
  isBanned: true,
  isDeleted: true,
} as const;
