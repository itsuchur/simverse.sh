"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useRouter } from "~/i18n/navigation";
import type { CatalogPackage } from "~/server/suppliers/esimaccess/catalog-types";

function formatVolume(bytes: number) {
  const gib = bytes / 1024 ** 3;
  if (gib >= 1) {
    return Number.isInteger(gib) ? `${gib} GB` : `${gib.toFixed(1)} GB`;
  }
  const mib = bytes / 1024 ** 2;
  return `${Math.round(mib)} MB`;
}

export default function OrderConfirmation({
  open,
  onOpenChange,
  pkg,
  destinationLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pkg: CatalogPackage;
  destinationLabel?: string;
}) {
  const t = useTranslations("OrderConfirmation");
  const tCatalog = useTranslations("Catalog");
  const format = useFormatter();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const price =
    typeof pkg.priceRub === "number"
      ? format.number(pkg.priceRub, {
          style: "currency",
          currency: "RUB",
          maximumFractionDigits: 0,
        })
      : "—";

  const duration =
    pkg.durationUnit.toLowerCase() === "day"
      ? tCatalog("duration.day", { count: pkg.duration })
      : `${pkg.duration} ${pkg.durationUnit.toLowerCase()}${pkg.duration === 1 ? "" : "s"}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="data-open:slide-in-from-bottom-4 data-closed:slide-out-to-bottom-4 data-open:zoom-in-100 data-closed:zoom-out-100 top-auto bottom-0 left-1/2 max-h-[min(85vh,28rem)] w-full max-w-[calc(100%-0rem)] translate-x-[-50%] translate-y-0 gap-4 rounded-t-2xl rounded-b-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <p className="text-foreground text-sm font-medium">
            {destinationLabel ? `${destinationLabel} · ` : null}
            {t("planSummary", {
              data: formatVolume(pkg.volume),
              duration,
            })}
            {" · "}
            {price}
          </p>
          <DialogDescription>{t("compatibility")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {error ? (
            <p className="text-destructive w-full text-center text-sm">
              {error}
            </p>
          ) : null}
          <Button
            type="button"
            className="w-full bg-blue-600 text-white hover:bg-blue-700"
            disabled={pending}
            onClick={() => {
              void (async () => {
                setPending(true);
                setError(null);
                try {
                  const headers: Record<string, string> = {
                    "Content-Type": "application/json",
                  };
                  if (process.env.NODE_ENV === "development") {
                    headers["ngrok-skip-browser-warning"] = "true";
                  }

                  const response = await fetch("/api/cart", {
                    method: "PUT",
                    credentials: "include",
                    headers,
                    body: JSON.stringify({ packageCode: pkg.packageCode }),
                  });

                  if (!response.ok) {
                    setError(t("buyFailed"));
                    return;
                  }

                  router.push("/checkout");
                } catch {
                  setError(t("buyFailed"));
                } finally {
                  setPending(false);
                }
              })();
            }}
          >
            {t("buyNow")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
