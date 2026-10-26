import { describe, expect, test } from "bun:test";

import { miniappPublicUrl } from "~/lib/miniapp-path";
import { topupAppliedMessage } from "~/server/telegram/topup-notice";
import { miniappOrigin } from "~/server/urls";

describe("topupAppliedMessage", () => {
  test("confirms a fixed-data top-up in English", () => {
    const message = topupAppliedMessage({
      languageCode: "en",
      packageName: "Spain 1GB 7Days",
      countryCode: "ES",
      dataAmountMb: 1024,
      validityDays: 7,
    });

    expect(message.text).toBe(
      ["Your top-up is successful!", "", "Spain", "1 GB · 7 days"].join("\n"),
    );
    expect(message.replyMarkup.inline_keyboard[0]?.[0]).toEqual({
      text: "My eSIMs",
      web_app: { url: miniappPublicUrl(miniappOrigin(), "/myesim") },
    });
  });

  test("labels a fair-use top-up Безлимит in Russian", () => {
    const message = topupAppliedMessage({
      preferredLanguage: "ru",
      packageName: "Japan 3GB/Day FUP1Mbps",
      countryCode: "JP",
      dataAmountMb: 3072,
      validityDays: 7,
    });

    expect(message.text).toContain("eSIM успешно пополнена!");
    expect(message.text).toContain("Безлимит · 7 дней");
    expect(message.text).not.toContain("3 GB");
    expect(message.replyMarkup.inline_keyboard[0]?.[0]?.text).toBe("Мои eSIM");
  });
});
