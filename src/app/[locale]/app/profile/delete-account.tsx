"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
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
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Card, CardTitle } from "~/components/ui/card";
import { useRouter } from "~/i18n/navigation";

/**
 * "Delete Account" profile row with a confirmation alert. Confirming
 * soft-deletes the account server-side and signs the user out; the route
 * refresh then lands them back on the consent screen.
 */
export function DeleteAccount() {
  const t = useTranslations("Profile");
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);

  const confirmDelete = () => {
    setDeleting(true);
    setFailed(false);
    fetch("/api/account/delete", { method: "POST" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`delete responded with ${response.status}`);
        }
        // Session is revoked; re-render server components without it.
        router.refresh();
      })
      .catch((error: unknown) => {
        console.error("[account] deletion failed", error);
        setFailed(true);
        setDeleting(false);
      });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Card
            size="sm"
            className="border-destructive hover:bg-destructive/5 w-full cursor-pointer transition-colors"
          />
        }
      >
        <div className="flex items-center gap-3 px-(--card-spacing)">
          <span className="bg-destructive/10 text-destructive flex size-9 shrink-0 items-center justify-center rounded-full">
            <Trash2 className="size-4" aria-hidden />
          </span>
          <CardTitle className="text-destructive min-w-0 flex-1">
            {t("deleteAccount")}
          </CardTitle>
        </div>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteConfirmDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-muted-foreground text-xs">
          {t.rich("deleteFinePrint", {
            support: (chunks) => (
              <a
                href="mailto:support@simverse.sh"
                className="underline underline-offset-3"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
        {failed ? (
          <p className="text-destructive text-sm">{t("deleteFailed")}</p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>
            {t("deleteCancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleting}
            onClick={confirmDelete}
          >
            {t("deleteConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
