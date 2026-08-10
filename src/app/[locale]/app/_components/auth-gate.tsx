"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { useRouter } from "~/i18n/navigation";
import { autoSignInFromMiniApp } from "~/lib/auth-client";

/**
 * Automatic Telegram Mini App sign-in.
 *
 * Rendered by the /app layout instead of the page content when there is no
 * session. Signs in silently using the initData Telegram injects into the
 * WebView, then refreshes the route so server components re-render with the
 * new session cookie.
 */
export function AuthGate() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [status, setStatus] = useState<"signing-in" | "failed">("signing-in");

  const signIn = useCallback(() => {
    autoSignInFromMiniApp()
      .then((result) => {
        if (result.error) {
          console.error("[auth] mini app sign-in failed", result.error);
          setStatus("failed");
          return;
        }
        // Session cookie is set; re-render server components with it.
        router.refresh();
      })
      .catch((error: unknown) => {
        // Thrown when not running inside Telegram (no initData available).
        console.error("[auth] mini app sign-in failed", error);
        setStatus("failed");
      });
  }, [router]);

  useEffect(() => {
    signIn();
  }, [signIn]);

  if (status === "signing-in") {
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStatus("signing-in");
              signIn();
            }}
          >
            {t("tryAgain")}
          </Button>
        </div>
      </Card>
    </main>
  );
}
