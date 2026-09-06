"use client";

import { useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";
import { DialogClose } from "~/components/ui/dialog";
import { cn } from "~/lib/utils";

export function OverlayBackToAppButton() {
  const t = useTranslations("Profile");

  return (
    <DialogClose
      render={
        <Button
          type="button"
          className={cn(
            "absolute left-3 z-50 h-9 rounded-full px-4 text-xs font-bold tracking-wide",
            "bg-[#2AABEE] text-white shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.08)] hover:bg-[#229ED9]",
            "top-[max(3.25rem,calc(var(--tg-safe-area-inset-top,env(safe-area-inset-top,0px))+var(--tg-content-safe-area-inset-top,0px)+0.5rem))]",
          )}
        />
      }
    >
      {t("backToApp")}
    </DialogClose>
  );
}
