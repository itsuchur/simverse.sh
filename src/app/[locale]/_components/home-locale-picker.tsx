"use client";

import { useLocale, useTranslations } from "next-intl";

import { buttonVariants } from "~/components/ui/button";
import { usePathname, useRouter } from "~/i18n/navigation";
import { routing } from "~/i18n/routing";
import { cn } from "~/lib/utils";

export function HomeLocalePicker() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav aria-label={t("label")} className="flex justify-end px-6 pt-4">
      <div className="flex gap-2">
        {routing.locales.map((nextLocale) => {
          const active = nextLocale === locale;
          return (
            <button
              key={nextLocale}
              type="button"
              aria-pressed={active}
              className={cn(
                buttonVariants({
                  size: "sm",
                  variant: active ? "default" : "outline",
                }),
                active && "pointer-events-none",
              )}
              onClick={() => {
                router.replace(pathname, { locale: nextLocale });
              }}
            >
              {t(nextLocale)}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
