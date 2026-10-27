import { describe, expect, test } from "bun:test";

import {
  startWelcome,
  welcomeLocale,
} from "~/server/telegram/start-welcome";
import { miniappOrigin } from "~/server/urls";

describe("welcomeLocale", () => {
  test("treats ru and ru-RU as Russian", () => {
    expect(welcomeLocale("ru")).toBe("ru");
    expect(welcomeLocale("ru-RU")).toBe("ru");
  });

  test("defaults missing and non-ru codes to English", () => {
    expect(welcomeLocale(undefined)).toBe("en");
    expect(welcomeLocale(null)).toBe("en");
    expect(welcomeLocale("en")).toBe("en");
    expect(welcomeLocale("de")).toBe("en");
  });
});

describe("startWelcome", () => {
  test("returns English copy, the English photo, and Open the App", () => {
    const welcome = startWelcome("en");
    expect(welcome.text).toBe(
      [
        "Internet abroad without roaming 🌍",
        "",
        'eSIM for 150+ countries from $4. Tap "Open the App", choose a country, and pay with USDT. Setup takes a couple of minutes.',
        "",
        "Questions: @simversesupport",
      ].join("\n"),
    );
    expect(welcome.text).not.toContain("СБП");
    expect(welcome.photo).toBe("https://simverse.sh/bot-start-pic-en.png");
    expect(welcome.replyMarkup.inline_keyboard[0]?.[0]).toEqual({
      text: "Open the App",
      web_app: { url: miniappOrigin() },
    });
  });

  test("returns Russian copy and the Russian photo for ru language codes", () => {
    const welcome = startWelcome("ru-RU");
    expect(welcome.text).toBe(
      [
        "Интернет за границей без роуминга 🌍",
        "",
        "eSIM для 150+ стран от 128 ₽. Нажмите «Открыть приложение», выберите страну и оплатите через СБП или USDT. Установка занимает пару минут.",
        "",
        "Вопросы: @simversesupport",
      ].join("\n"),
    );
    expect(welcome.photo).toBe("https://simverse.sh/bot-start-pic.png");
    expect(welcome.replyMarkup.inline_keyboard[0]?.[0]?.text).toBe(
      "Открыть приложение",
    );
  });
});
