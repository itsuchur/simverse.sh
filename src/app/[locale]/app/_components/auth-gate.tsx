"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { NextIntlClientProvider, useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import type enMessages from "../../../../../messages/en.json";
import { Link, useRouter } from "~/i18n/navigation";
import { autoSignInFromMiniApp } from "~/lib/auth-client";
import { waitForTelegramInitData } from "~/lib/telegram-webapp";

// Literal message types (from the generated en.json declaration) so the
// nested NextIntlClientProvider accepts them; runtime values differ per
// locale.
export type ConsentMessages = (typeof enMessages)["Consent"];

type ConsentLocale = "en" | "ru";

type Phase = "checking" | "consent" | "signing-in" | "failed";

/**
 * Telegram Mini App sign-in gate.
 *
 * Rendered by the /app layout instead of the page content when there is no
 * session. First asks the server whether this Telegram user needs to accept
 * the ToS/Privacy consent screen (new user, or an account they previously
 * deleted). Existing users are signed in silently as before; consenting
 * users are registered only after ticking the agreement checkbox.
 *
 * The consent screen is localized from the Telegram initData language code
 * (ru or en, en fallback) rather than the route locale, so it reads
 * correctly before the user ever picks a language in the app.
 */
export function AuthGate({
  consentMessages,
}: {
  consentMessages: Record<ConsentLocale, ConsentMessages>;
}) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [consentLocale, setConsentLocale] = useState<ConsentLocale>("en");
  const [attempt, setAttempt] = useState(0);

  const signIn = useCallback(
    (restoreDeleted: boolean) => {
      setPhase("signing-in");
      autoSignInFromMiniApp()
        .then(async (result) => {
          if (result.error) {
            console.error("[auth] mini app sign-in failed", result.error);
            setPhase("failed");
            return;
          }
          if (restoreDeleted) {
            // No-op unless the account was soft-deleted; recovers it.
            await fetch("/api/account/restore", { method: "POST" }).catch(
              (error: unknown) => {
                console.error("[auth] account restore failed", error);
              },
            );
          }
          // Session cookie is set; re-render server components with it.
          router.refresh();
        })
        .catch((error: unknown) => {
          // Thrown when not running inside Telegram (no initData available).
          console.error("[auth] mini app sign-in failed", error);
          setPhase("failed");
        });
    },
    [router],
  );

  useEffect(() => {
    let cancelled = false;

    const precheck = async () => {
      const initData = await waitForTelegramInitData();
      const response = await fetch("/api/account/precheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });
      if (!response.ok) {
        throw new Error(`precheck responded with ${response.status}`);
      }
      const { needsConsent } = (await response.json()) as {
        needsConsent: boolean;
      };
      return needsConsent;
    };

    precheck()
      .then((needsConsent) => {
        if (cancelled) return;
        const languageCode =
          window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
        setConsentLocale(languageCode?.startsWith("ru") ? "ru" : "en");
        if (needsConsent) {
          setPhase("consent");
        } else {
          signIn(false);
        }
      })
      .catch((error: unknown) => {
        console.error("[auth] consent precheck failed", error);
        if (!cancelled) setPhase("failed");
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, signIn]);

  const retry = () => {
    setPhase("checking");
    setAttempt((count) => count + 1);
  };

  if (phase === "consent") {
    return (
      <NextIntlClientProvider
        locale={consentLocale}
        messages={{ Consent: consentMessages[consentLocale] }}
      >
        <ConsentScreen locale={consentLocale} onContinue={() => signIn(true)} />
      </NextIntlClientProvider>
    );
  }

  if (phase === "checking" || phase === "signing-in") {
    return (
      <main className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 py-24">
        <LoaderCircle className="size-6 animate-spin" aria-hidden />
        <p className="text-sm">{t("signingIn")}</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col justify-center py-24">
      <Card>
        <CardHeader>
          <CardTitle>{t("requiredTitle")}</CardTitle>
          <CardDescription>{t("requiredDescription")}</CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          <Button variant="outline" size="sm" onClick={retry}>
            {t("tryAgain")}
          </Button>
        </div>
      </Card>
    </main>
  );
}

function ConsentScreen({
  locale,
  onContinue,
}: {
  locale: ConsentLocale;
  onContinue: () => void;
}) {
  const t = useTranslations("Consent");
  const [agreed, setAgreed] = useState(false);

  return (
    <main className="flex flex-1 flex-col justify-center py-24">
      <Card>
        <CardHeader>
          <CardTitle>{t("welcome")}</CardTitle>
        </CardHeader>
        <div className="space-y-4 px-6 pb-6">
          <div className="flex items-start gap-3">
            <Checkbox
              id="consent-agreement"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked)}
              className="mt-0.5"
            />
            <label htmlFor="consent-agreement" className="text-sm">
              {t.rich("agreement", {
                tos: (chunks) => (
                  <Link
                    href="/tos"
                    locale={locale}
                    className="underline underline-offset-3"
                  >
                    {chunks}
                  </Link>
                ),
                privacy: (chunks) => (
                  <Link
                    href="/privacy-policy"
                    locale={locale}
                    className="underline underline-offset-3"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </label>
          </div>
          <Button className="w-full" disabled={!agreed} onClick={onContinue}>
            {t("continue")}
          </Button>
        </div>
      </Card>
    </main>
  );
}
