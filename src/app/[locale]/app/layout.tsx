import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

// Paused with the welcome screen (hurts conversion). Uncomment with AuthGate's
// consentMessages prop.
// import enMessages from "../../../../messages/en.json";
// import ruMessages from "../../../../messages/ru.json";
import { AcquisitionTracker } from "./_components/acquisition-tracker";
import { AuthGate } from "./_components/auth-gate";
import { FingerprintCollector } from "./_components/fingerprint-collector";
import { MiniAppChrome } from "./_components/mini-app-chrome";
import { PostHogIdentify } from "./_components/posthog-identify";
import { PostHogPageView } from "./_components/posthog-page-view";
import { PostHogProvider } from "./_components/posthog-provider";
import { StartParamRouter } from "./_components/start-param-router";
import { getSession } from "~/server/better-auth/server";
import { redirectToPreferredLocale } from "~/server/preferred-locale";

// The consent screen picks its language from Telegram initData on the
// client (before any session or locale preference exists), so it needs the
// messages for both locales up front.
// const consentMessages: Record<"en" | "ru", ConsentMessages> = {
//   en: enMessages.Consent,
//   // The declared message types use en literals; they are erased at runtime.
//   ru: ruMessages.Consent as ConsentMessages,
// };

export default async function MiniAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Gate the mini app behind a session. First-time visitors are signed in
  // automatically by <AuthGate /> using Telegram initData, then the route is
  // refreshed and renders the actual content. Reading the session also makes
  // every /app route dynamic, which the catalog requires anyway.
  const session = await getSession();
  if (session) {
    await redirectToPreferredLocale(session.user.id);
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <PostHogProvider>
        <PostHogPageView />
        <MiniAppChrome showNav={Boolean(session)}>
          {session ? children : <AuthGate />}
          {session ? <StartParamRouter /> : null}
          {session ? (
            <PostHogIdentify
              telegramId={session.user.telegramId ?? null}
              languageCode={session.user.languageCode ?? null}
              isPremium={Boolean(session.user.isPremium)}
              fingerprint={session.user.fingerprint ?? null}
            />
          ) : null}
          {session ? <AcquisitionTracker /> : null}
          {session && !session.user.fingerprint ? (
            <FingerprintCollector />
          ) : null}
        </MiniAppChrome>
      </PostHogProvider>
    </NextIntlClientProvider>
  );
}
