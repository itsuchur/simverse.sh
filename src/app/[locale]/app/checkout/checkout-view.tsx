"use client";

import { useEffect, useState } from "react";
import { Astroid, Bitcoin, ChevronLeft, CreditCard, Globe } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import ReactCountryFlag from "react-country-flag";

import { Button } from "~/components/ui/button";
import { useRouter } from "~/i18n/navigation";
import type { CartPlan } from "~/lib/cart-plan";
import { captureAppEvent } from "~/lib/posthog/browser";
import { parseName } from "~/server/suppliers/esimaccess/parse-package-name";
import {
  openTelegramInvoice,
  prepareTelegramWebApp,
} from "~/lib/telegram-webapp";

async function checkoutHeaders() {
  const headers: Record<string, string> = {};
  if (process.env.NODE_ENV === "development") {
    headers["ngrok-skip-browser-warning"] = "true";
  }
  return headers;
}

async function requestInvoice(path: string) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: await checkoutHeaders(),
  });
  if (!response.ok) {
    throw new Error("invoice_http");
  }
  const body = (await response.json()) as { invoiceUrl?: string };
  if (!body.invoiceUrl) {
    throw new Error("invoice_missing");
  }
  return body.invoiceUrl;
}

async function requestStarsInvoice() {
  return requestInvoice("/api/checkout/stars");
}

async function requestCryptomusInvoice() {
  return requestInvoice("/api/checkout/cryptomus");
}

async function requestCardlinkInvoice(locale: string) {
  const response = await fetch("/api/checkout/cardlink", {
    method: "POST",
    credentials: "include",
    headers: {
      ...(await checkoutHeaders()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ locale }),
  });
  if (!response.ok) {
    throw new Error("invoice_http");
  }
  const body = (await response.json()) as { invoiceUrl?: string };
  if (!body.invoiceUrl) {
    throw new Error("invoice_missing");
  }
  return body.invoiceUrl;
}

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

function coverageLabel(plan: CartPlan, locale: string) {
  const codes = plan.country.split(",").filter(Boolean);
  if (codes.length === 1 && codes[0]) {
    return countryDisplayName(codes[0], locale);
  }
  if (locale === "ru" && plan.nameRu) {
    return plan.nameRu.split(" — ")[0] ?? plan.nameRu;
  }
  return parseName(plan.name)?.label ?? plan.name;
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
            width: "2.25em",
            height: "2.25em",
            flexShrink: 0,
            display: "block",
          }}
          aria-label={name}
        />
        <h1 className="min-w-0 text-3xl leading-snug font-semibold">{name}</h1>
      </div>
    );
  }

  const label = locale === "ru" && plan.nameRu ? plan.nameRu : plan.name;
  return (
    <div className="flex items-center gap-4">
      <Globe className="size-9 shrink-0" aria-hidden />
      <h1 className="min-w-0 text-3xl leading-snug font-semibold">{label}</h1>
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
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    prepareTelegramWebApp();
  }, []);

  useEffect(() => {
    captureAppEvent("checkout_started", {
      packageCode: plan.packageCode,
      country: plan.country,
      dataGb: plan.data_gb,
      validityDays: plan.validity_days,
      priceUsd: plan.price,
      priceRub: plan.price_rub,
      priceStars: plan.price_stars,
    });
  }, [
    plan.packageCode,
    plan.country,
    plan.data_gb,
    plan.validity_days,
    plan.price,
    plan.price_rub,
    plan.price_stars,
  ]);

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
  const coverage = coverageLabel(plan, locale);

  return (
    <main className="flex flex-1 flex-col gap-8 py-4">
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-ml-1.5 text-foreground"
          disabled={leaving || paying}
          aria-label={t("backToApp")}
          onClick={() => {
            void (async () => {
              setLeaving(true);
              try {
                await fetch("/api/cart", {
                  method: "DELETE",
                  credentials: "include",
                  headers: await checkoutHeaders(),
                });
              } finally {
                router.push("/app");
              }
            })();
          }}
        >
          <ChevronLeft className="size-6" strokeWidth={2.5} />
        </Button>

        <DestinationHeader plan={plan} locale={locale} />
      </div>

      <hr className="border-border" />

      <dl className="flex flex-col gap-4 text-lg leading-snug">
        <div className="flex items-baseline justify-between gap-6">
          <dt className="text-muted-foreground shrink-0">{t("coverage")}</dt>
          <dd className="min-w-0 text-right font-medium">{coverage}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-6">
          <dt className="text-muted-foreground shrink-0">{t("data")}</dt>
          <dd className="font-medium">{data}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-6">
          <dt className="text-muted-foreground shrink-0">{t("validity")}</dt>
          <dd className="font-medium">{duration}</dd>
        </div>
      </dl>

      <div className="mt-auto flex flex-col gap-3">
        {payError ? (
          <p className="text-destructive w-full text-center text-lg">
            {payError}
          </p>
        ) : null}
        <Button
          type="button"
          size="lg"
          className="h-12 w-full text-lg"
          disabled={leaving || paying}
          onClick={() => {
            setPaying(true);
            setPayError(null);
            captureAppEvent("checkout_method_selected", {
              method: "stars",
              packageCode: plan.packageCode,
            });
            void requestStarsInvoice()
              .then((url) => {
                captureAppEvent("checkout_invoice_opened", {
                  method: "stars",
                  packageCode: plan.packageCode,
                });
                return openTelegramInvoice(url);
              })
              .then((status) => {
                if (status === "paid" || status === "pending") {
                  router.push("/app/myesim");
                  return;
                }
                if (status === "failed") {
                  captureAppEvent("checkout_invoice_failed", {
                    method: "stars",
                    packageCode: plan.packageCode,
                  });
                  setPayError(t("payFailed"));
                }
              })
              .catch((error: unknown) => {
                console.error("[checkout] stars invoice", error);
                captureAppEvent("checkout_invoice_failed", {
                  method: "stars",
                  packageCode: plan.packageCode,
                });
                setPayError(t("payFailed"));
              })
              .finally(() => {
                setPaying(false);
              });
          }}
        >
          <Astroid data-icon="inline-start" className="size-6" />
          {t("payStars", { price: starsPrice })}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="h-12 w-full text-lg"
          disabled={leaving || paying}
          onClick={() => {
            setPaying(true);
            setPayError(null);
            captureAppEvent("checkout_method_selected", {
              method: "cardlink",
              packageCode: plan.packageCode,
            });
            void requestCardlinkInvoice(locale)
              .then((url) => {
                captureAppEvent("checkout_invoice_opened", {
                  method: "cardlink",
                  packageCode: plan.packageCode,
                });
                window.location.assign(url);
              })
              .catch((error: unknown) => {
                console.error("[checkout] cardlink invoice", error);
                captureAppEvent("checkout_invoice_failed", {
                  method: "cardlink",
                  packageCode: plan.packageCode,
                });
                setPayError(t("payFailed"));
                setPaying(false);
              });
          }}
        >
          <CreditCard data-icon="inline-start" className="size-6" />
          {t("payCard", { price: cardPrice })}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="h-12 w-full text-lg"
          disabled={leaving || paying}
          onClick={() => {
            setPaying(true);
            setPayError(null);
            captureAppEvent("checkout_method_selected", {
              method: "cryptomus",
              packageCode: plan.packageCode,
            });
            void requestCryptomusInvoice()
              .then((url) => {
                captureAppEvent("checkout_invoice_opened", {
                  method: "cryptomus",
                  packageCode: plan.packageCode,
                });
                window.location.assign(url);
              })
              .catch((error: unknown) => {
                console.error("[checkout] cryptomus invoice", error);
                captureAppEvent("checkout_invoice_failed", {
                  method: "cryptomus",
                  packageCode: plan.packageCode,
                });
                setPayError(t("payFailed"));
                setPaying(false);
              });
          }}
        >
          <Bitcoin data-icon="inline-start" className="size-6" />
          {t("payCryptomus", { price: cardPrice })}
        </Button>
      </div>
    </main>
  );
}
