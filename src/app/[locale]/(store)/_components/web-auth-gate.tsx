"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { useRouter } from "~/i18n/navigation";
import { signOut } from "~/lib/auth-client";

import { TelegramLogin } from "./telegram-login";

/**
 * Website sign-in card. A user who deleted their account must confirm the
 * restore before the session counts, matching the Mini App gate.
 */
export function WebAuthGate({
  botUsername,
  deletedAccount,
}: {
  botUsername: string;
  deletedAccount: boolean;
}) {
  const t = useTranslations("Store");
  const tAuth = useTranslations("Auth");
  const router = useRouter();
  const [restoring, setRestoring] = useState(deletedAccount);
  const [failed, setFailed] = useState(false);

  const onSignedIn = useCallback(
    (deleted: boolean) => {
      if (deleted) setRestoring(true);
      else router.refresh();
    },
    [router],
  );

  async function restore() {
    const response = await fetch("/api/account/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed: true }),
    }).catch(() => null);
    if (!response?.ok) {
      setFailed(true);
      return;
    }
    setRestoring(false);
    router.refresh();
  }

  async function keepDeleted() {
    await signOut().catch(() => undefined);
    setRestoring(false);
    router.refresh();
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">{t("loginTitle")}</CardTitle>
        <CardDescription className="leading-6">
          {t("loginDescription")}
        </CardDescription>
      </CardHeader>
      <div className="px-6 pb-6">
        <TelegramLogin botUsername={botUsername} onSignedIn={onSignedIn} />
        {failed ? (
          <p role="alert" className="text-destructive mt-3 text-center text-sm">
            {tAuth("reasonNetwork")}
          </p>
        ) : null}
      </div>
      <AlertDialog
        open={restoring}
        onOpenChange={(open) => {
          if (!open) void keepDeleted();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tAuth("restoreTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tAuth("restoreDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => void keepDeleted()}>
              {tAuth("keepDeleted")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => void restore()}>
              {tAuth("restoreAccount")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export function SignOutButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        void signOut().finally(() => router.refresh());
      }}
    >
      {label}
    </Button>
  );
}
