import "server-only";

import { setChatMenuButton } from "~/server/telegram/bot-api";
import { welcomeLocale } from "~/server/telegram/start-welcome";
import { miniappOrigin } from "~/server/urls";

const MENU_BUTTON_TEXT = {
  en: "Open app",
  ru: "Открыть приложение",
} as const;

export async function syncChatMenuButton(input: {
  telegramId?: unknown;
  preferredLanguage?: unknown;
}) {
  const telegramId =
    typeof input.telegramId === "string" ? input.telegramId : null;
  if (telegramId == null || telegramId.length === 0) {
    return;
  }

  const chatId = Number(telegramId);
  if (!Number.isFinite(chatId) || chatId <= 0) {
    return;
  }

  const preferredLanguage =
    typeof input.preferredLanguage === "string"
      ? input.preferredLanguage
      : null;

  try {
    await setChatMenuButton({
      chatId,
      text: MENU_BUTTON_TEXT[welcomeLocale(preferredLanguage)],
      url: miniappOrigin(),
    });
  } catch (error) {
    console.error("[telegram] setChatMenuButton failed", error);
  }
}
