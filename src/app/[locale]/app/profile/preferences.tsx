"use client";

import { ChevronRight, Settings } from "lucide-react";
import { useTranslations } from "next-intl";

import { LocaleSwitcher } from "../_components/locale-switcher";
import { Card, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

export function Preferences() {
  const t = useTranslations("Profile");

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Card
            size="sm"
            className="hover:bg-muted/40 w-full cursor-pointer transition-colors"
          />
        }
      >
        <div className="flex items-center gap-3 px-(--card-spacing)">
          <span className="bg-muted text-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
            <Settings className="size-4" aria-hidden />
          </span>
          <CardTitle className="min-w-0 flex-1">{t("preferences")}</CardTitle>
          <ChevronRight
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden
          />
        </div>
      </DialogTrigger>
      <DialogContent className="data-open:zoom-in-100 data-closed:zoom-out-100 bg-background inset-0 top-0 left-0 flex h-[var(--tg-viewport-stable-height,100dvh)] max-h-[var(--tg-viewport-stable-height,100dvh)] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 ring-0 sm:max-w-none">
        <DialogHeader className="shrink-0 px-14 pt-[max(1rem,calc(var(--tg-safe-area-inset-top,env(safe-area-inset-top,0px))+var(--tg-content-safe-area-inset-top,0px)))] pb-3">
          <DialogTitle className="text-center text-xl leading-snug">
            {t("preferences")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("languageDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-4 pb-[max(1.5rem,calc(var(--tg-safe-area-inset-bottom,env(safe-area-inset-bottom,0px))+var(--tg-content-safe-area-inset-bottom,0px)))] [-webkit-overflow-scrolling:touch]">
          <div className="mx-auto max-w-lg">
            <LocaleSwitcher />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
