import "server-only";

import { miniappOrigin } from "~/server/urls";

const MARKETING_ORIGIN = "https://simverse.sh";

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
      "Internet abroad without roaming 🌍",
      "",
      'eSIM for 150+ countries from $4. Tap "Open the App", choose a country, and pay with USDT. Setup takes a couple of minutes.',
      "",
      "Questions: @simversesupport",
    ].join("\n"),
    button: "Open the App",
    photo: "/bot-start-pic-en.png",
  },
  ru: {
    text: [
      "Интернет за границей без роуминга 🌍",
      "",
      "eSIM для 150+ стран от 128 ₽. Нажмите «Открыть приложение», выберите страну и оплатите через СБП или USDT. Установка занимает пару минут.",
      "",
      "Вопросы: @simversesupport",
    ].join("\n"),
    button: "Открыть приложение",
    photo: "/bot-start-pic.png",
  },
} as const;

export function startWelcome(languageCode?: string | null): {
  text: string;
  photo: string;
  replyMarkup: WelcomeReplyMarkup;
} {
  const locale = welcomeLocale(languageCode);
  const copy = COPY[locale];
  return {
    text: copy.text,
    photo: `${MARKETING_ORIGIN}${copy.photo}`,
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
