"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { useRouter } from "~/i18n/navigation";
import { autoSignInFromMiniApp } from "~/lib/auth-client";
import { waitForTelegramInitData } from "~/lib/telegram-webapp";

type Phase = "checking" | "restore" | "deleted" | "signing-in" | "failed";

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

/** Signs in automatically, except when restoration requires explicit consent. */
export function AuthGate() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [failReason, setFailReason] = useState<FailReason>("network");
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
            const response = await fetch("/api/account/restore", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ confirmed: true }),
            }).catch(() => {
              throw new SignInError("network");
            });
            if (!response.ok) {
              fail("network");
              return;
            }
          }
          router.refresh();
        })
        .catch((error: unknown) => {
          console.error("[auth] mini app sign-in failed", error);
          fail(error instanceof SignInError ? error.reason : "no-initdata");
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
      const { requiresRestoration } = (await response.json()) as {
        requiresRestoration: boolean;
      };
      if (typeof requiresRestoration !== "boolean")
        throw new SignInError("network");
      return requiresRestoration;
    };

    precheck()
      .then((requiresRestoration) => {
        if (cancelled) return;
        if (requiresRestoration) setPhase("restore");
        else signIn(false);
      })
      .catch((error: unknown) => {
        console.error("[auth] account precheck failed", error);
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

  if (phase === "restore" || phase === "deleted") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 py-24">
        <p className="text-muted-foreground text-center">
          {t("accountDeleted")}
        </p>
        <Button variant="outline" onClick={() => setPhase("restore")}>
          {t("restoreAccount")}
        </Button>
        <AlertDialog
          open={phase === "restore"}
          onOpenChange={(open) => {
            if (!open) setPhase("deleted");
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("restoreTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("restoreDescription")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPhase("deleted")}>
                {t("keepDeleted")}
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => signIn(true)}>
                {t("restoreAccount")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
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
