import { beforeEach, expect, test } from "bun:test";

import { syncChatMenuButton } from "~/server/telegram/menu-button";
import { miniappOrigin } from "~/server/urls";
import { telegramSetChatMenuButton } from "~/test/mocks";

beforeEach(() => {
  telegramSetChatMenuButton.mockClear();
  telegramSetChatMenuButton.mockImplementation(async () => undefined);
});

test("sets the Russian menu label for a ru preference", async () => {
  await syncChatMenuButton({ telegramId: "42", preferredLanguage: "ru" });
  expect(telegramSetChatMenuButton).toHaveBeenCalledWith({
    chatId: 42,
    text: "Открыть приложение",
    url: miniappOrigin(),
  });
});

test("sets the English menu label otherwise", async () => {
  await syncChatMenuButton({ telegramId: "42", preferredLanguage: "en" });
  expect(telegramSetChatMenuButton).toHaveBeenCalledWith({
    chatId: 42,
    text: "Open app",
    url: miniappOrigin(),
  });
});

test("skips when telegramId is missing or not a positive number", async () => {
  await syncChatMenuButton({ telegramId: null, preferredLanguage: "ru" });
  await syncChatMenuButton({ telegramId: "", preferredLanguage: "ru" });
  await syncChatMenuButton({ preferredLanguage: "ru" });
  await syncChatMenuButton({ telegramId: "nope", preferredLanguage: "ru" });
  expect(telegramSetChatMenuButton).not.toHaveBeenCalled();
});

test("does not reject when the Bot API throws", async () => {
  telegramSetChatMenuButton.mockImplementation(async () => {
    throw new Error("chat not found");
  });
  const original = console.error;
  console.error = () => undefined;
  try {
    await syncChatMenuButton({ telegramId: "42", preferredLanguage: "ru" });
  } finally {
    console.error = original;
  }
  expect(telegramSetChatMenuButton).toHaveBeenCalledTimes(1);
});
