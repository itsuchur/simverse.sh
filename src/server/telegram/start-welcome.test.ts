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
  test("returns English copy and Open the App web_app button by default", () => {
    const welcome = startWelcome("en");
    expect(welcome.text).toContain("Welcome to Simverse!");
    expect(welcome.text).toContain("Mastercard, Visa, MIR, Russian SBP, or USDT");
    expect(welcome.text).toContain("190 countries");
    expect(welcome.text).toContain("registered business");
    expect(welcome.text).not.toContain("Добро пожаловать");
    expect(welcome.replyMarkup.inline_keyboard[0]?.[0]).toEqual({
      text: "Open the App",
      web_app: { url: miniappOrigin() },
    });
  });

  test("returns Russian copy and Открыть приложение for ru language codes", () => {
    const welcome = startWelcome("ru-RU");
    expect(welcome.text).toContain("Добро пожаловать в Simverse!");
    expect(welcome.text).toContain("Mastercard, Visa, МИР, СБП или USDT");
    expect(welcome.text).toContain("190 странах");
    expect(welcome.text).toContain("зарегистрированный бизнес");
    expect(welcome.replyMarkup.inline_keyboard[0]?.[0]?.text).toBe(
      "Открыть приложение",
    );
  });
});
