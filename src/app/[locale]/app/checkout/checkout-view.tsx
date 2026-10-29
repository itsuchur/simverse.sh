"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, Globe, LoaderCircle, Clock3 } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import ReactCountryFlag from "react-country-flag";

import { Button, buttonVariants } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { UnlimitedDataLabel } from "~/components/ui/unlimited-data-label";
import { Link, useRouter } from "~/i18n/navigation";
import type { CartPlan } from "~/lib/cart-plan";
import { parsePromoCode } from "~/lib/promo-code";
import { captureAppEvent } from "~/lib/posthog/browser";
import { parseName } from "~/server/suppliers/esimaccess/parse-package-name";
import { openExternalLink } from "~/lib/telegram-webapp";
import { useMiniappPath } from "~/lib/use-miniapp-path";
import { CoverageList } from "../_components/coverage-list";
import type { CatalogCoverage } from "~/server/suppliers/esimaccess/catalog-types";

async function checkoutHeaders() {
  const headers: Record<string, string> = {};
  if (process.env.NODE_ENV === "development") {
    headers["ngrok-skip-browser-warning"] = "true";
  }
  return headers;
}

async function requestInvoice(
  path: string,
  cartRevision: string,
  locale: string,
  promoCode?: string,
  paymentMethod?: "card" | "sbp",
) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers: {
        ...(await checkoutHeaders()),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cartRevision,
        locale,
        paymentMethod,
        ...(promoCode ? { promoCode } : {}),
      }),
    });
    const body = (await response.json()) as {
      invoiceUrl?: string;
      orderUuid?: string;
      error?: string;
    };
    if (body.error === "invoice_in_progress") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }
    if (!response.ok || !body.invoiceUrl || !body.orderUuid)
      throw new Error(body.error ?? "invoice_http");
    return { invoiceUrl: body.invoiceUrl, orderUuid: body.orderUuid };
  }
  throw new Error("invoice_in_progress");
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

export function CheckoutView({
  plan,
  cartRevision,
  supportTopUpType,
  networkCoverage,
  initialPayment = null,
}: {
  plan: CartPlan;
  cartRevision: string;
  supportTopUpType: number | undefined;
  networkCoverage: CatalogCoverage[];
  initialPayment?: { orderUuid: string; invoiceUrl: string } | null;
}) {
  const t = useTranslations("Checkout");
  const tCatalog = useTranslations("Catalog");
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();
  const homeHref = useMiniappPath("/");
  const [leaving, setLeaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payment, setPayment] = useState(initialPayment);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [wantsPromo, setWantsPromo] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [acceptedPromo, setAcceptedPromo] = useState<{
    code: string;
    discountPercent: number;
    priceRub: number;
    priceUsd: number;
  } | null>(null);
  const invoiceRequested = useRef(false);
  const myEsimsHref = useMiniappPath("/myesim");
  const controlsLocked = leaving || paying || payment !== null || applyingPromo;

  function promoMessage(code: string) {
    switch (code) {
      case "invalid_code":
        return t("promoInvalid");
      case "promo_not_found":
        return t("promoNotFound");
      case "promo_inactive":
        return t("promoInactive");
      case "promo_used":
        return t("promoUsed");
      case "promo_held":
        return t("promoHeld");
      case "promo_exhausted":
        return t("promoExhausted");
      case "promo_too_small":
        return t("promoTooSmall");
      case "rate_limited":
        return t("promoRateLimited");
      case "cart_changed":
        return t("cartChanged");
      default:
        return t("payFailed");
    }
  }

  function clearPromo() {
    setWantsPromo(false);
    setPromoInput("");
    setPromoError(null);
    setAcceptedPromo(null);
  }

  async function applyPromo() {
    const code = parsePromoCode(promoInput);
    if (!code) {
      setAcceptedPromo(null);
      setPromoError(t("promoInvalid"));
      return;
    }
    setApplyingPromo(true);
    setPromoError(null);
    try {
      const response = await fetch("/api/checkout/promo", {
        method: "POST",
        credentials: "include",
        headers: {
          ...(await checkoutHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cartRevision, promoCode: code }),
      });
      const body = (await response.json()) as {
        error?: string;
        discountPercent?: number;
        priceRub?: number;
        priceUsd?: number;
      };
      if (
        !response.ok ||
        typeof body.discountPercent !== "number" ||
        typeof body.priceRub !== "number" ||
        typeof body.priceUsd !== "number"
      ) {
        setAcceptedPromo(null);
        setPromoError(promoMessage(body.error ?? "pay_failed"));
        if (body.error === "cart_changed") router.refresh();
        return;
      }
      setPromoInput(code);
      setAcceptedPromo({
        code,
        discountPercent: body.discountPercent,
        priceRub: body.priceRub,
        priceUsd: body.priceUsd,
      });
    } catch {
      setAcceptedPromo(null);
      setPromoError(t("payFailed"));
    } finally {
      setApplyingPromo(false);
    }
  }

  function openInvoice(url: string) {
    openExternalLink(url);
  }

  function pay(
    method: "xhub_sbp" | "trybit" | "paypal",
    path: string,
    paymentMethod?: "card" | "sbp",
  ) {
    const promoCode = acceptedPromo?.code;
    if (invoiceRequested.current || payment) return;
    invoiceRequested.current = true;
    setPaying(true);
    setPayError(null);
    captureAppEvent("checkout_method_selected", {
      method,
      packageCode: plan.packageCode,
    });
    void requestInvoice(path, cartRevision, locale, promoCode, paymentMethod)
      .then((invoice) => {
        captureAppEvent("checkout_invoice_opened", {
          method,
          packageCode: plan.packageCode,
        });
        setPayment(invoice);
        openInvoice(invoice.invoiceUrl);
        setPaying(false);
      })
      .catch((error: unknown) => {
        invoiceRequested.current = false;
        console.error(`[checkout] ${method} invoice`, error);
        captureAppEvent("checkout_invoice_failed", {
          method,
          packageCode: plan.packageCode,
        });
        setPayError(
          error instanceof Error ? promoMessage(error.message) : t("payFailed"),
        );
        if (error instanceof Error && error.message === "cart_changed") {
          router.refresh();
        }
        setPaying(false);
      });
  }

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

  useEffect(() => {
    if (!payment || paymentConfirmed) return;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;
    async function checkPayment() {
      try {
        const response = await fetch(
          `/api/checkout/status?orderUuid=${encodeURIComponent(payment!.orderUuid)}`,
          {
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
            headers: await checkoutHeaders(),
          },
        );
        if (response.ok) {
          const body = (await response.json()) as { paymentStatus?: string };
          if (body.paymentStatus === "paid") {
            setPaymentConfirmed(true);
            return;
          }
        }
      } catch {
        // Keep the existing invoice available during a temporary connection loss.
      }
      if (!controller.signal.aborted)
        timeout = setTimeout(() => {
          void checkPayment();
        }, 5000);
    }
    void checkPayment();
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [payment, paymentConfirmed]);

  useEffect(() => {
    if (!paymentConfirmed) return;
    const timeout = setTimeout(() => router.replace(myEsimsHref), 1500);
    return () => clearTimeout(timeout);
  }, [paymentConfirmed, router, myEsimsHref]);

  const priceUsd = acceptedPromo?.priceUsd ?? plan.price;
  const priceRub = acceptedPromo?.priceRub ?? plan.price_rub;
  const cryptoPrice =
    locale === "ru"
      ? `${format.number(priceUsd, { maximumFractionDigits: 0 })} USDT`
      : format.number(priceUsd, {
          style: "currency",
          currency: "USD",
        });
  const sbpPrice = format.number(priceRub, {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  });

  const duration = tCatalog("duration.day", { count: plan.validity_days });
  const fullSpeedAmount = formatDataGb(plan.data_gb);
  const coverage = coverageLabel(plan, locale);

  return (
    <main className="flex flex-1 flex-col gap-8 py-4">
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-foreground -ml-1.5"
          disabled={leaving || paying}
          aria-label={t("backToApp")}
          onClick={() => {
            void (async () => {
              setLeaving(true);
              try {
                if (!payment)
                  await fetch("/api/cart", {
                    method: "DELETE",
                    credentials: "include",
                    headers: await checkoutHeaders(),
                  });
              } finally {
                router.push(homeHref);
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
          <dd className="font-medium">
            {plan.isUnlimited ? (
              <UnlimitedDataLabel
                fullSpeedAmount={fullSpeedAmount}
                packageName={plan.name}
              />
            ) : (
              fullSpeedAmount
            )}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-6">
          <dt className="text-muted-foreground shrink-0">{t("validity")}</dt>
          <dd className="font-medium">{duration}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-6">
          <dt className="text-muted-foreground">{t("topUps")}</dt>
          <dd className="text-right font-medium">
            {t(
              supportTopUpType === 2
                ? "topUpsDataAndValidity"
                : supportTopUpType === 3
                  ? "topUpsValidity"
                  : "notSupported",
            )}
          </dd>
        </div>
      </dl>

      {plan.country.split(",").filter(Boolean).length > 1 ? (
        <details className="border-border rounded-xl border p-4">
          <summary className="cursor-pointer font-medium">
            {tCatalog("supportedCountries")}
          </summary>
          <div className="mt-4">
            <CoverageList
              packages={[{ location: plan.country, coverage: networkCoverage }]}
              locale={locale}
            />
          </div>
        </details>
      ) : (
        <CoverageList
          packages={[{ location: plan.country, coverage: networkCoverage }]}
          locale={locale}
          showCountry={false}
        />
      )}

      {payment ? (
        <section
          className="mt-auto flex flex-col gap-4 rounded-xl border p-5"
          aria-label={t("paymentStatusLabel")}
        >
          <div role="status" className="flex items-center gap-3">
            {paymentConfirmed ? (
              <LoaderCircle className="size-6 animate-spin" aria-hidden />
            ) : (
              <Clock3 className="size-6 shrink-0" aria-hidden />
            )}
            <p className="text-lg font-medium">
              {t(paymentConfirmed ? "paymentReceived" : "waitingForPayment")}
            </p>
          </div>
          {!paymentConfirmed ? (
            <>
              <p className="text-muted-foreground leading-7">
                {t("waitingDescription")}
              </p>
              <Button
                size="lg"
                className="h-12 text-lg"
                onClick={() => openInvoice(payment.invoiceUrl)}
              >
                {t("continuePayment")}
              </Button>
            </>
          ) : null}
          <Link
            href={myEsimsHref}
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className: "h-12 text-lg",
            })}
          >
            {t("myEsims")}
          </Link>
        </section>
      ) : (
        <div className="mt-auto flex flex-col gap-3">
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-3 text-lg">
              <Checkbox
                checked={wantsPromo}
                disabled={controlsLocked}
                onCheckedChange={(checked) => {
                  if (checked === true) {
                    setWantsPromo(true);
                    return;
                  }
                  clearPromo();
                }}
              />
              {t("havePromo")}
            </label>
            {wantsPromo ? (
              <form
                className="flex flex-col gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void applyPromo();
                }}
              >
                <div className="flex gap-2">
                  <Input
                    value={promoInput}
                    disabled={controlsLocked}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={32}
                    placeholder={t("promoPlaceholder")}
                    aria-label={t("promoPlaceholder")}
                    className="h-12 text-lg uppercase"
                    onChange={(event) => {
                      const next = event.target.value;
                      setPromoInput(next);
                      setPromoError(null);
                      if (
                        acceptedPromo &&
                        next.trim().toUpperCase() !== acceptedPromo.code
                      ) {
                        setAcceptedPromo(null);
                      }
                    }}
                  />
                  <Button
                    type="submit"
                    size="lg"
                    variant="outline"
                    className="h-12 shrink-0 text-lg"
                    disabled={controlsLocked || promoInput.trim() === ""}
                  >
                    {t("promoApply")}
                  </Button>
                </div>
                {acceptedPromo ? (
                  <p className="text-lg font-medium">
                    {t("promoApplied", {
                      percent: String(acceptedPromo.discountPercent),
                    })}
                  </p>
                ) : null}
                {promoError ? (
                  <p className="text-destructive text-lg">{promoError}</p>
                ) : null}
              </form>
            ) : null}
          </div>
          {paying ? (
            <p role="status" className="flex items-center justify-center gap-2">
              <LoaderCircle className="size-5 animate-spin" aria-hidden />
              {t("creatingPayment")}
            </p>
          ) : null}
          {payError ? (
            <p className="text-destructive w-full text-center text-lg">
              {payError}
            </p>
          ) : null}
          {locale === "ru" ? (
            <Button
              type="button"
              size="lg"
              className="h-12 w-full border border-emerald-900 bg-emerald-700 text-lg text-white hover:bg-emerald-800"
              disabled={controlsLocked}
              onClick={() => pay("xhub_sbp", "/api/checkout/xhub", "sbp")}
            >
              <Image
                src="/SBP.svg"
                alt=""
                width={48}
                height={24}
                data-icon="inline-start"
                className="h-6 w-12 shrink-0 object-contain"
              />
              {t("paySbp", { price: sbpPrice })}
            </Button>
          ) : null}
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="h-12 w-full text-lg"
            disabled={controlsLocked}
            onClick={() => pay("trybit", "/api/checkout/trybit")}
          >
            <Image
              src="/USDT.svg"
              alt=""
              width={24}
              height={24}
              data-icon="inline-start"
              className="size-6 shrink-0"
            />
            {t("payCrypto", { price: cryptoPrice })}
          </Button>
          {locale === "en" ? (
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="h-12 w-full text-lg"
              disabled={controlsLocked}
              onClick={() => pay("paypal", "/api/checkout/paypal")}
            >
              <Image
                src="/paypal.svg"
                alt=""
                width={24}
                height={24}
                data-icon="inline-start"
                className="size-6 shrink-0"
              />
              {t("payPaypal")}
            </Button>
          ) : null}
        </div>
      )}
    </main>
  );
}
