"use client";

import { useCallback, useEffect, useState } from "react";
// Paused with the welcome screen (hurts conversion). Uncomment with ConsentScreen.
// import { useRef } from "react";
// import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
// import { NextIntlClientProvider } from "next-intl";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
// import { Checkbox } from "~/components/ui/checkbox";
// import type enMessages from "../../../../../messages/en.json";
// import { LegalLink } from "../../_components/legal-link";
import { useRouter } from "~/i18n/navigation";
// import { getPathname } from "~/i18n/navigation";
import { autoSignInFromMiniApp } from "~/lib/auth-client";
// import { marketingUrl } from "~/lib/marketing-url";
import { waitForTelegramInitData } from "~/lib/telegram-webapp";

// Literal message types (from the generated en.json declaration) so the
// nested NextIntlClientProvider accepts them; runtime values differ per
// locale.
// export type ConsentMessages = (typeof enMessages)["Consent"];
//
// type ConsentLocale = "en" | "ru";

type Phase = "checking" | "consent" | "signing-in" | "failed";

/**
 * Why sign-in failed, shown on the failure card to make WebView issues
 * diagnosable without devtools access:
 * - "no-initdata": Telegram never injected initData (opened outside a Mini App).
 * - "rejected": the server refused the initData HMAC (401) — almost always a
 *   TELEGRAM_BOT_TOKEN that belongs to a different bot than the one launched.
 * - "network": fetch failed or the server errored.
 */
type FailReason = "no-initdata" | "rejected" | "network";

class SignInError extends Error {
  constructor(public reason: FailReason) {
    super(reason);
  }
}

function reasonOf(error: unknown): FailReason {
  return error instanceof SignInError ? error.reason : "network";
}

/**
 * Telegram Mini App sign-in gate.
 *
 * Rendered by the /app layout instead of the page content when there is no
 * session. Asks the server whether this Telegram user is new or previously
 * deleted, then signs them in. The welcome / ToS consent screen is paused
 * because it hurts conversion: new and deleted users sign in immediately,
 * and signIn(true) still restores a soft-deleted account.
 */
export function AuthGate() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [failReason, setFailReason] = useState<FailReason>("network");
  // Paused with the welcome screen. Uncomment with the consent phase below.
  // const [consentLocale, setConsentLocale] = useState<ConsentLocale>("en");
  const [attempt, setAttempt] = useState(0);

  const fail = useCallback((reason: FailReason) => {
    setFailReason(reason);
    setPhase("failed");
  }, []);

  const signIn = useCallback(
    (restoreDeleted: boolean) => {
      setPhase("signing-in");
      autoSignInFromMiniApp()
        .then(async (result) => {
          if (result.error) {
            console.error("[auth] mini app sign-in failed", result.error);
            fail(result.error.status === 401 ? "rejected" : "network");
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
          fail("no-initdata");
        });
    },
    [router, fail],
  );

  useEffect(() => {
    let cancelled = false;

    const precheck = async () => {
      const initData = await waitForTelegramInitData().catch(() => {
        throw new SignInError("no-initdata");
      });
      const response = await fetch("/api/account/precheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });
      if (response.status === 401) {
        throw new SignInError("rejected");
      }
      if (!response.ok) {
        throw new SignInError("network");
      }
      const { needsConsent } = (await response.json()) as {
        needsConsent: boolean;
      };
      return needsConsent;
    };

    precheck()
      .then((needsConsent) => {
        if (cancelled) return;
        // Welcome / ToS consent screen is paused because it hurts conversion.
        // signIn(true) is what Continue did: register new users and restore
        // soft-deleted accounts. Restore the commented consent phase below
        // to show the screen again.
        signIn(needsConsent);
      })
      .catch((error: unknown) => {
        console.error("[auth] consent precheck failed", error);
        if (!cancelled) fail(reasonOf(error));
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, signIn, fail]);

  const retry = () => {
    setPhase("checking");
    setAttempt((count) => count + 1);
  };

  /*
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
  */

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
          <CardDescription>
            {failReason === "no-initdata"
              ? t("requiredDescription")
              : failReason === "rejected"
                ? t("reasonRejected")
                : t("reasonNetwork")}
          </CardDescription>
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

/*
function ConsentScreen({
  locale,
  onContinue,
}: {
  locale: ConsentLocale;
  onContinue: () => void;
}) {
  const t = useTranslations("Consent");
  const [agreed, setAgreed] = useState(false);
  const featureAreaRef = useRef<HTMLDivElement>(null);
  const featureContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    webApp?.setHeaderColor?.("#FFF5EA");
    webApp?.setBackgroundColor?.("#FFF5EA");
    return () => {
      webApp?.setHeaderColor?.("#ffffff");
      webApp?.setBackgroundColor?.("#ffffff");
    };
  }, []);

  useEffect(() => {
    const area = featureAreaRef.current;
    const content = featureContentRef.current;
    if (!area || !content) return;

    // Measure untransformed content, including translated text wrapping.
    // Consent and Continue keep their full size outside this fitted area.
    const fit = () => {
      const scale = Math.min(
        1,
        area.clientHeight / Math.max(1, content.offsetHeight),
      );
      content.style.transform = `scale(${scale})`;
    };
    const observer = new ResizeObserver(fit);
    observer.observe(area);
    observer.observe(content);
    fit();
    return () => observer.disconnect();
  }, []);

  return (
    <main
      data-welcome-screen
      className="mx-auto flex w-full max-w-sm min-w-0 flex-1 flex-col px-2 pt-[clamp(0.75rem,3dvh,2rem)] pb-2 text-[#271B14] sm:px-4"
    >
      <div ref={featureAreaRef} className="relative min-h-0 flex-1">
        <div
          ref={featureContentRef}
          className="absolute inset-x-0 top-0 flex origin-top flex-col items-center text-center"
        >
          <div
            aria-hidden
            className="flex aspect-square w-[min(12rem,23dvh,100%)] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#FFEBDD]"
          >
            <DotLottieReact
              src="/welcomeScreenESIM.json"
              loop
              autoplay
              className="aspect-square w-full"
            />
          </div>
          <h1 className="mt-[clamp(1rem,3dvh,1.75rem)] text-[clamp(1.5rem,4dvh,1.875rem)] leading-tight font-semibold tracking-tight text-balance">
            {t("title")}
          </h1>
          <p className="mt-2 text-lg leading-relaxed">{t("subtitle")}</p>
          <ul className="mt-3 w-fit max-w-full list-disc space-y-1 pl-5 text-left text-base leading-snug [overflow-wrap:anywhere]">
            {(
              [
                "feature1",
                "feature2",
                "feature3",
                "feature4",
                "feature5",
              ] as const
            ).map((key) => (
              <li key={key}>
                {t.rich(key, {
                  bold: (chunks) => (
                    <strong className="font-bold">{chunks}</strong>
                  ),
                })}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="shrink-0 pt-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="consent-agreement"
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked)}
            className="mt-0.5 size-7 rounded-lg border-[#271B14]/60 bg-transparent focus-visible:border-[#271B14] focus-visible:ring-[#271B14]/30 data-checked:border-[#271B14] data-checked:bg-[#271B14] data-checked:text-white dark:bg-transparent dark:data-checked:bg-[#271B14] [&_svg]:size-5"
          />
          <label
            htmlFor="consent-agreement"
            className="min-w-0 cursor-pointer text-sm leading-relaxed [overflow-wrap:anywhere]"
          >
            {t.rich("agreement", {
              tos: (chunks) => (
                <LegalLink
                  href={marketingUrl(getPathname({ href: "/tos", locale }))}
                  className="underline-offset-3"
                >
                  {chunks}
                </LegalLink>
              ),
              privacy: (chunks) => (
                <LegalLink
                  href={marketingUrl(
                    getPathname({ href: "/privacy-policy", locale }),
                  )}
                  className="underline-offset-3"
                >
                  {chunks}
                </LegalLink>
              ),
            })}
          </label>
        </div>
        <Button
          className="mt-4 h-14 w-full rounded-2xl bg-[#271B14] text-lg font-semibold text-white hover:bg-[#402C20] focus-visible:border-[#271B14] focus-visible:ring-[#271B14]/30 disabled:opacity-50"
          disabled={!agreed}
          onClick={onContinue}
        >
          {t("continue")}
        </Button>
      </div>
    </main>
  );
}
*/
