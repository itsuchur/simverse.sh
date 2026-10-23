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
        <script
          {...{ nowprocket: "", "seraph-accel-crit": "1" }}
          data-noptimize="1"
          data-cfasync="false"
          data-wpfc-render="false"
          data-no-defer="1"
          data-cmp-ab="2"
          dangerouslySetInnerHTML={{
            __html: `(function () {
  var script = document.createElement("script");
  script.async = 1;
  script.setAttribute("data-cmp-ab", "2");
  script.src = 'https://emrldco.com/NTg5NzQ0.js?t=589744';
  document.head.appendChild(script);
})();`,
          }}
        />
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
