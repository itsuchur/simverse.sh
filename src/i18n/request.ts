import { hasLocale, type AbstractIntlMessages } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";

import en from "../../messages/en.json";
import ru from "../../messages/ru.json";
import { routing } from "./routing";

const messagesByLocale: Record<
  (typeof routing.locales)[number],
  AbstractIntlMessages
> = {
  en,
  ru,
};

export default getRequestConfig(async ({ locale }) => {
  if (!locale) {
    const paramValue = await rootParams.locale();
    if (hasLocale(routing.locales, paramValue)) {
      locale = paramValue;
    } else {
      notFound();
    }
  }

  return {
    locale,
    messages: messagesByLocale[locale],
  };
});
