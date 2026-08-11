"use client";

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
      <DialogContent
        className="top-auto bottom-0 left-1/2 max-h-[min(85vh,28rem)] w-full max-w-[calc(100%-0rem)] translate-x-[-50%] translate-y-0 gap-4 rounded-b-none rounded-t-2xl sm:max-w-md data-open:slide-in-from-bottom-4 data-closed:slide-out-to-bottom-4 data-open:zoom-in-100 data-closed:zoom-out-100"
      >
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
        <DialogFooter>
          <Button
            type="button"
            className="w-full bg-blue-600 text-white hover:bg-blue-700"
          >
            {t("buyNow")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
