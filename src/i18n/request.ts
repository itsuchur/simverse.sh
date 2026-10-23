import { hasLocale, type AbstractIntlMessages } from "next-intl";
import { getRequestConfig } from "next-intl/server";
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

export default getRequestConfig(async ({ locale, requestLocale }) => {
  if (!locale) {
    // next/root-params ships a bare module declaration; the real types are
    // generated into .next/types by `next dev`, so lint from a clean checkout
    // sees `any` here.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const paramValue: unknown = await rootParams.locale();
    if (hasLocale(routing.locales, paramValue)) {
      locale = paramValue;
    } else {
      // Global not-found pages have no root params. Use the language negotiated
      // by the proxy (or setRequestLocale) when rendering outside that layout.
      const negotiatedLocale = await requestLocale;
      locale = hasLocale(routing.locales, negotiatedLocale)
        ? negotiatedLocale
        : routing.defaultLocale;
    }
  }

  return {
    locale,
    messages: messagesByLocale[locale],
  };
});
