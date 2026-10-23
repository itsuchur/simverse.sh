"use client";

import { ChevronDown, Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import ReactCountryFlag from "react-country-flag";

import { buttonVariants } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { usePathname, useRouter } from "~/i18n/navigation";
import { routing } from "~/i18n/routing";
import { cn } from "~/lib/utils";

const LOCALE_FLAGS = {
  en: "US",
  ru: "RU",
} as const satisfies Record<(typeof routing.locales)[number], string>;

export function HomeLocalePicker() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <nav aria-label={t("label")} className="flex justify-end">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label={t("label")}
          className={cn(
            buttonVariants({ size: "default", variant: "ghost" }),
            "h-9 gap-1 px-2.5 lg:h-12 lg:gap-2 lg:px-4 [&_svg:not([class*='size-'])]:size-5",
          )}
        >
          <Globe aria-hidden className="size-5 lg:size-7" />
          <ChevronDown aria-hidden className="size-4 opacity-70 lg:size-5" />
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="end"
          className="w-auto min-w-36 p-1"
        >
          <ul className="flex flex-col" role="listbox" aria-label={t("label")}>
            {routing.locales.map((nextLocale) => {
              const active = nextLocale === locale;
              return (
                <li key={nextLocale}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors outline-none lg:gap-3 lg:px-4 lg:py-2.5 lg:text-base",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted",
                    )}
                    onClick={() => {
                      setOpen(false);
                      if (!active) {
                        router.replace(pathname, { locale: nextLocale });
                      }
                    }}
                  >
                    <ReactCountryFlag
                      countryCode={LOCALE_FLAGS[nextLocale]}
                      svg
                      style={{
                        width: "1.25em",
                        height: "1.25em",
                        flexShrink: 0,
                        display: "block",
                        borderRadius: "2px",
                      }}
                      aria-hidden
                    />
                    {t(nextLocale)}
                  </button>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
    </nav>
  );
}
