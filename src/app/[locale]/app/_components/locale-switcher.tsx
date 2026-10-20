"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { updatePreferredLanguageAction } from "../profile/actions";
import { Button } from "~/components/ui/button";
import { usePathname, useRouter } from "~/i18n/navigation";
import { routing } from "~/i18n/routing";
import { cn } from "~/lib/utils";

export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const tProfile = useTranslations("Profile");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-base leading-none font-medium">{t("label")}</h3>
        <p className="text-muted-foreground text-sm">
          {tProfile("languageDescription")}
        </p>
      </div>
      <div className="flex gap-2">
        {routing.locales.map((nextLocale) => {
          const active = nextLocale === locale;
          return (
            <Button
              key={nextLocale}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              aria-pressed={active}
              disabled={pending}
              className={cn("flex-1", active && "pointer-events-none")}
              onClick={() => {
                setPending(true);
                void updatePreferredLanguageAction(nextLocale)
                  .then(() => {
                    router.replace(pathname, { locale: nextLocale });
                  })
                  .finally(() => {
                    setPending(false);
                  });
              }}
            >
              {t(nextLocale)}
            </Button>
          );
        })}
      </div>
    </section>
  );
}
