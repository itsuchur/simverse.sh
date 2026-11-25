import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

import { MarketingFooter } from "../_components/marketing-footer";
import { MarketingHeader } from "../_components/marketing-header";
import { pickMessages, STORE_CLIENT_NAMESPACES } from "~/i18n/client-messages";

/** Website store: public catalog plus Telegram-authenticated checkout and account. */
export default async function StoreLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const messages = pickMessages(await getMessages(), STORE_CLIENT_NAMESPACES);

  return (
    <NextIntlClientProvider messages={messages}>
      <div className="bg-background relative flex min-h-dvh flex-col">
        <MarketingHeader />
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10 sm:px-6 sm:py-14">
          {children}
        </div>
        <MarketingFooter />
      </div>
    </NextIntlClientProvider>
  );
}
