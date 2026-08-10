"use client";

import { useLocale, useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { usePathname, useRouter } from "~/i18n/navigation";
import { routing } from "~/i18n/routing";
import { cn } from "~/lib/utils";

export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const tProfile = useTranslations("Profile");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("label")}</CardTitle>
        <CardDescription>{tProfile("languageDescription")}</CardDescription>
      </CardHeader>
      <div className="flex gap-2 px-(--card-spacing) pb-(--card-spacing)">
        {routing.locales.map((nextLocale) => {
          const active = nextLocale === locale;
          return (
            <Button
              key={nextLocale}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              aria-pressed={active}
              className={cn("flex-1", active && "pointer-events-none")}
              onClick={() => {
                router.replace(pathname, { locale: nextLocale });
              }}
            >
              {t(nextLocale)}
            </Button>
          );
        })}
      </div>
    </Card>
  );
}
