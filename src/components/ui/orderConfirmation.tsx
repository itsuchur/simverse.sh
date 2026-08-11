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
  pkg: CatalogPackage | null;
  destinationLabel?: string;
}) {
  const t = useTranslations("OrderConfirmation");
  const tCatalog = useTranslations("Catalog");
  const format = useFormatter();

  const price =
    pkg && typeof pkg.priceRub === "number"
      ? format.number(pkg.priceRub, {
          style: "currency",
          currency: "RUB",
          maximumFractionDigits: 0,
        })
      : "—";

  const duration =
    pkg == null
      ? ""
      : pkg.durationUnit.toLowerCase() === "day"
        ? tCatalog("duration.day", { count: pkg.duration })
        : `${pkg.duration} ${pkg.durationUnit.toLowerCase()}${pkg.duration === 1 ? "" : "s"}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          {pkg ? (
            <p className="text-foreground text-sm font-medium">
              {destinationLabel ? `${destinationLabel} · ` : null}
              {t("planSummary", {
                data: formatVolume(pkg.volume),
                duration,
              })}
              {" · "}
              {price}
            </p>
          ) : null}
          <DialogDescription>{t("compatibility")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" className="w-full sm:w-auto">
            {t("buyNow")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
