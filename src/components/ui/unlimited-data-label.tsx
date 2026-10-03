"use client";

import { CircleHelp } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { parseName } from "~/server/suppliers/esimaccess/parse-package-name";

type UnlimitedDataLabelProps = {
  fullSpeedAmount: string;
  packageName: string;
  className?: string;
  triggerClassName?: string;
};

export function UnlimitedDataLabel({
  fullSpeedAmount,
  packageName,
  className,
  triggerClassName,
}: UnlimitedDataLabelProps) {
  const t = useTranslations("Catalog");
  const parsed = parseName(packageName);
  const perDay = parsed?.perDay === true;
  const speed = parsed?.fup
    ? parsed.fup.unit === "M"
      ? t("unlimitedSpeedMbps", { speed: String(parsed.fup.value) })
      : t("unlimitedSpeedKbps", { speed: String(parsed.fup.value) })
    : null;

  let description: string;
  if (perDay && speed) {
    description = t("unlimitedDetailsPerDayWithSpeed", {
      amount: fullSpeedAmount,
      speed,
    });
  } else if (perDay) {
    description = t("unlimitedDetailsPerDay", {
      amount: fullSpeedAmount,
    });
  } else if (speed) {
    description = t("unlimitedDetailsWithSpeed", {
      amount: fullSpeedAmount,
      speed,
    });
  } else {
    description = t("unlimitedDetails", {
      amount: fullSpeedAmount,
    });
  }

  return (
    <span className={cn("inline-flex items-baseline", className)}>
      <span>{t("unlimitedLabel")}</span>
      <Popover>
        <PopoverTrigger
          aria-label={t("unlimitedHelpLabel")}
          className={cn(
            "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 relative -top-0.5 -mx-1.5 -my-2 inline-flex size-8 items-center justify-center rounded-full outline-none focus-visible:ring-3",
            triggerClassName,
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <CircleHelp aria-hidden className="size-3.5" strokeWidth={2} />
        </PopoverTrigger>
        <PopoverContent>
          <PopoverTitle>{t("unlimitedHelpTitle")}</PopoverTitle>
          <PopoverDescription>{description}</PopoverDescription>
        </PopoverContent>
      </Popover>
    </span>
  );
}
