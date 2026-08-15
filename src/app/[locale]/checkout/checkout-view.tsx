"use client";

import { useState } from "react";
import { ChevronLeft, Globe } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import ReactCountryFlag from "react-country-flag";

import { Button } from "~/components/ui/button";
import { useRouter } from "~/i18n/navigation";
import type { CartPlan } from "~/lib/cart-plan";

function formatDataGb(dataGb: number) {
  if (dataGb >= 1) {
    return Number.isInteger(dataGb)
      ? `${dataGb} GB`
      : `${dataGb.toFixed(1)} GB`;
  }
  return `${Math.round(dataGb * 1024)} MB`;
}

function countryDisplayName(countryCode: string, locale: string) {
  try {
    return (
      new Intl.DisplayNames([locale], { type: "region" }).of(countryCode) ??
      countryCode
    );
  } catch {
    return countryCode;
  }
}

function DestinationHeader({
  plan,
  locale,
}: {
  plan: CartPlan;
  locale: string;
}) {
  const codes = plan.country.split(",").filter(Boolean);
  const isSingleCountry = codes.length === 1;
  const countryCode = codes[0];

  if (isSingleCountry && countryCode) {
    const name = countryDisplayName(countryCode, locale);
    return (
      <div className="flex items-center gap-4">
        <ReactCountryFlag
          countryCode={countryCode}
          svg
          style={{
            width: "1.75em",
            height: "1.75em",
            flexShrink: 0,
            display: "block",
          }}
          aria-label={name}
        />
        <h1 className="min-w-0 text-2xl leading-snug font-semibold">{name}</h1>
      </div>
    );
  }

  const label = locale === "ru" && plan.nameRu ? plan.nameRu : plan.name;
  return (
    <div className="flex items-center gap-4">
      <Globe className="size-7 shrink-0" aria-hidden />
      <h1 className="min-w-0 text-2xl leading-snug font-semibold">{label}</h1>
    </div>
  );
}

export function CheckoutView({ plan }: { plan: CartPlan }) {
  const t = useTranslations("Checkout");
  const tCatalog = useTranslations("Catalog");
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  const cardPrice =
    locale === "ru"
      ? format.number(plan.price_rub, {
          style: "currency",
          currency: "RUB",
          maximumFractionDigits: 0,
        })
      : format.number(plan.price, {
          style: "currency",
          currency: "USD",
        });

  const starsPrice = format.number(plan.price_stars);
  const duration = tCatalog("duration.day", { count: plan.validity_days });
  const data = formatDataGb(plan.data_gb);

  return (
    <main className="flex flex-1 flex-col gap-8 py-4">
      <Button
        type="button"
        variant="ghost"
        size="lg"
        className="-ml-2.5 h-11 px-3 text-base"
        disabled={leaving}
        onClick={() => {
          void (async () => {
            setLeaving(true);
            try {
              const headers: Record<string, string> = {};
              if (process.env.NODE_ENV === "development") {
                headers["ngrok-skip-browser-warning"] = "true";
              }
              await fetch("/api/cart", {
                method: "DELETE",
                credentials: "include",
                headers,
              });
            } finally {
              router.push("/app");
            }
          })();
        }}
      >
        <ChevronLeft data-icon="inline-start" className="size-5" />
        {t("backToApp")}
      </Button>

      <DestinationHeader plan={plan} locale={locale} />

      {plan.networks.length > 0 ? (
        plan.networks.length > 3 ? (
          <p className="text-muted-foreground text-base leading-7">
            {tCatalog("countriesAndNetworks", {
              count: String(plan.networks.length),
            })}
          </p>
        ) : (
          <ul className="text-muted-foreground list-inside list-disc space-y-1 text-base leading-7">
            {plan.networks.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        )
      ) : null}

      <p className="text-foreground text-lg leading-snug font-medium">
        {data} · {duration}
      </p>

      <div className="mt-auto flex flex-col gap-3">
        <Button type="button" size="lg" className="h-11 w-full text-base">
          {t("payStars", { price: starsPrice })}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="h-11 w-full text-base"
        >
          {t("payCard", { price: cardPrice })}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="h-11 w-full text-base"
        >
          {t("payCryptomus")}
        </Button>
      </div>
    </main>
  );
}
