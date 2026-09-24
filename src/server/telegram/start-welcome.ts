import "server-only";

import { miniappOrigin } from "~/server/urls";

export type WelcomeLocale = "en" | "ru";

export type WelcomeReplyMarkup = {
  inline_keyboard: Array<
    Array<{
      text: string;
      web_app: { url: string };
    }>
  >;
};

export function welcomeLocale(
  languageCode: string | undefined | null,
): WelcomeLocale {
  return languageCode?.startsWith("ru") ? "ru" : "en";
}

const COPY = {
  en: {
    text: [
      "Welcome to Simverse!",
      "",
      "We sell travel eSIMs you can install in minutes — coverage in about 190 countries at affordable prices.",
      "",
      "Pay with Mastercard, Visa, MIR, Russian SBP, or USDT.",
      "",
      "Our support team is ready to help whenever you need it.",
      "",
      "We're a registered business.",
    ].join("\n"),
    button: "Open shop",
  },
  ru: {
    text: [
      "Добро пожаловать в Simverse!",
      "",
      "Мы продаём travel eSIM, которые устанавливаются за минуты — покрытие примерно в 190 странах по доступным ценам.",
      "",
      "Оплата: Mastercard, Visa, МИР, СБП или USDT.",
      "",
      "Поддержка всегда на связи и готова помочь.",
      "",
      "Мы — зарегистрированный бизнес.",
    ].join("\n"),
    button: "Открыть магазин",
  },
} as const;

export function startWelcome(languageCode?: string | null): {
  text: string;
  replyMarkup: WelcomeReplyMarkup;
} {
  const locale = welcomeLocale(languageCode);
  const copy = COPY[locale];
  return {
    text: copy.text,
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: copy.button,
            web_app: { url: miniappOrigin() },
          },
        ],
      ],
    },
  };
}
