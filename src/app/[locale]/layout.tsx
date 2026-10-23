import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { notFound } from "next/navigation";
import Script from "next/script";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

import {
  MARKETING_CLIENT_NAMESPACES,
  pickMessages,
} from "~/i18n/client-messages";
import { routing } from "~/i18n/routing";
import { TRPCReactProvider } from "~/trpc/react";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");

  return {
    title: t("title"),
    description: t("description"),
    icons: [{ rel: "icon", url: "/favicon.ico" }],
  };
}

const geist = Geist({
  subsets: ["latin", "cyrillic"],
  variable: "--font-geist-sans",
});

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  if (!hasLocale(routing.locales, (await params).locale)) notFound();
  const locale = await getLocale();
  const messages = pickMessages(
    await getMessages(),
    MARKETING_CLIENT_NAMESPACES,
  );

  return (
    <html lang={locale} className={`${geist.variable} font-sans antialiased`}>
      <head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
