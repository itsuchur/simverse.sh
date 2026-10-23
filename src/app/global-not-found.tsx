import "~/styles/globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

import {
  MARKETING_CLIENT_NAMESPACES,
  pickMessages,
} from "~/i18n/client-messages";
import { isAppLocale } from "~/i18n/preferred-locale";

import MarketingNotFound from "./[locale]/not-found";

const geist = Geist({
  subsets: ["latin", "cyrillic"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "404 — Simverse",
  robots: { index: false, follow: true },
};

export default async function GlobalNotFound() {
  // Unmatched routes bypass the locale layout, but next-intl's proxy still
  // provides the negotiated language. Assets excluded from the proxy use English.
  const requestedLocale = (await headers()).get("x-next-intl-locale");
  const locale = isAppLocale(requestedLocale) ? requestedLocale : "en";
  setRequestLocale(locale);
  const messages = pickMessages(
    await getMessages({ locale }),
    MARKETING_CLIENT_NAMESPACES,
  );

  return (
    <html lang={locale} className={`${geist.variable} font-sans antialiased`}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <MarketingNotFound />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
