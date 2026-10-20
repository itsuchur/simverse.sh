"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Calendar, Globe, QrCode } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import ReactCountryFlag from "react-country-flag";

import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  formatByteVolume,
  isActivationConfirmed,
  type LifecycleFocus,
} from "~/lib/esim-lifecycle";
import type { TopupOffers, TopupPackageOffer } from "~/lib/topup-offer";
import { openExternalLink } from "~/lib/telegram-webapp";
import {
  isFupPackageName,
  parseName,
} from "~/server/suppliers/esimaccess/parse-package-name";

import type { MyEsimOrder } from "./myesim-list";

const DAY_MS = 86_400_000;

type PanelFocus = Extract<
  LifecycleFocus,
  { kind: "remaining" | "usageUnavailable" | "exhausted" }
>;

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

function bytePair(order: MyEsimOrder) {
  if (!order.dataTotalBytes || order.dataUsedBytes === null) return null;
  try {
    const total = BigInt(order.dataTotalBytes);
    const used = BigInt(order.dataUsedBytes);
    const remaining = total - used;
    return { total, remaining: remaining < 0n ? 0n : remaining };
  } catch {
    return null;
  }
}

function dayCount(order: MyEsimOrder) {
  if (isActivationConfirmed(order) && order.expiresAt) {
    const end = new Date(order.expiresAt).getTime();
    if (Number.isFinite(end)) {
      return Math.max(0, Math.ceil((end - Date.now()) / DAY_MS));
    }
  }
  return order.validityDays;
}

function DataGauge({
  ratio,
  center,
  label,
}: {
  ratio: number | null;
  center: string;
  label: string;
}) {
  return (
    <svg
      viewBox="0 0 120 68"
      className="h-16 w-28 shrink-0"
      role="img"
      aria-label={label}
    >
      <path
        d="M12 58 A48 48 0 0 1 108 58"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        className="text-muted-foreground/25"
        pathLength={100}
      />
      {ratio !== null ? (
        <path
          d="M12 58 A48 48 0 0 1 108 58"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          className="text-foreground"
          pathLength={100}
          strokeDasharray={`${Math.min(1, Math.max(0, ratio)) * 100} 100`}
        />
      ) : null}
      <text
        x="60"
        y="54"
        textAnchor="middle"
        fill="currentColor"
        fontSize="13"
        fontWeight="600"
      >
        {center}
      </text>
    </svg>
  );
}

function InfinityMark({ label }: { label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className="bg-foreground inline-block size-12"
      style={{
        maskImage: "url(/infinity-icon.svg)",
        WebkitMaskImage: "url(/infinity-icon.svg)",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskSize: "contain",
        WebkitMaskSize: "contain",
      }}
    />
  );
}

async function requestHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.NODE_ENV === "development") {
    headers["ngrok-skip-browser-warning"] = "true";
  }
  return headers;
}

export function UsagePanel({
  order,
  focus,
}: {
  order: MyEsimOrder;
  focus: PanelFocus;
}) {
  const t = useTranslations("MyEsims");
  const tCatalog = useTranslations("Catalog");
  const tCheckout = useTranslations("Checkout");
  const locale = useLocale();
  const format = useFormatter();
  const unlimited = isFupPackageName(order.packageName);
  const parsed = parseName(order.packageName);
  const usagePair = bytePair(order);
  const [open, setOpen] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [days, setDays] = useState(7);
  const [offers, setOffers] = useState<TopupOffers | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(false);
  const [quoting, setQuoting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      setQuoting(true);
      const params = new URLSearchParams({
        orderUuid: order.orderUuid,
        days: String(days),
      });
      void fetch(`/api/myesim/topup?${params.toString()}`, {
        credentials: "include",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
      })
        .then(async (response) => {
          if (!response.ok) return;
          setOffers((await response.json()) as TopupOffers);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setQuoting(false);
        });
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [open, days, order.orderUuid]);

  const countryCode = order.countryCode;
  const singleCountry = countryCode !== null && !countryCode.includes(",");
  const title = singleCountry
    ? countryDisplayName(countryCode, locale)
    : order.packageName;
  const daysLabel = tCatalog("duration.day", { count: dayCount(order) });

  let speedCaption: string | null = null;
  if (unlimited) {
    if (focus.kind === "usageUnavailable") {
      speedCaption = t("usageUnavailable");
    } else if (focus.kind === "exhausted") {
      speedCaption = t("dataExhausted");
    } else if (usagePair?.remaining === 0n) {
      const speed = parsed?.fup
        ? parsed.fup.unit === "M"
          ? tCatalog("unlimitedSpeedMbps", { speed: String(parsed.fup.value) })
          : tCatalog("unlimitedSpeedKbps", { speed: String(parsed.fup.value) })
        : null;
      speedCaption = speed ? t("nowAtSpeed", { speed }) : t("reducedSpeed");
    } else if (focus.kind === "remaining") {
      const amount = formatByteVolume(focus.remainingBytes);
      speedCaption = parsed?.perDay
        ? t("fullSpeedLeftToday", { amount })
        : t("fullSpeedLeft", { amount });
    }
  }

  const trigger =
    unlimited && focus.kind !== "exhausted"
      ? t("unlimited")
      : focus.kind === "remaining"
        ? t("remainingData", { amount: formatByteVolume(focus.remainingBytes) })
        : focus.kind === "exhausted"
          ? t("dataExhausted")
          : t("usageUnavailable");

  const gaugeRatio =
    !unlimited &&
    usagePair &&
    usagePair.total > 0n &&
    focus.kind !== "usageUnavailable"
      ? Number(usagePair.remaining) / Number(usagePair.total)
      : null;
  const gaugeCenter = !unlimited
    ? focus.kind === "usageUnavailable" || !usagePair
      ? "—"
      : formatByteVolume(usagePair.remaining)
    : "";

  function rubPrice(amount: number) {
    return format.number(amount, {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0,
    });
  }

  function usdPrice(amount: number) {
    return locale === "ru"
      ? `${format.number(amount, { maximumFractionDigits: 0 })} USDT`
      : format.number(amount, { style: "currency", currency: "USD" });
  }

  async function pay(
    provider: "trybit" | "xhub",
    selection: { packageCode?: string; days?: number },
  ) {
    setPaying(true);
    setPayError(false);
    try {
      const response = await fetch("/api/checkout/topup", {
        method: "POST",
        credentials: "include",
        headers: await requestHeaders(),
        body: JSON.stringify({
          orderUuid: order.orderUuid,
          provider,
          locale,
          ...selection,
        }),
      });
      const body = (await response.json()) as { invoiceUrl?: string };
      if (!response.ok || !body.invoiceUrl) {
        setPayError(true);
        return;
      }
      openExternalLink(body.invoiceUrl);
    } catch {
      setPayError(true);
    } finally {
      setPaying(false);
    }
  }

  const selected =
    offers?.mode === "packages"
      ? (offers.packages.find((pkg) => pkg.packageCode === selectedCode) ??
        null)
      : null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setChoosing(false);
          setPayError(false);
        }
      }}
    >
      <PopoverTrigger className="w-fit text-left text-base font-semibold">
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-[min(24rem,calc(100vw-2rem))] max-w-none p-4"
      >
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex items-center gap-2">
              {singleCountry ? (
                <ReactCountryFlag
                  countryCode={countryCode}
                  svg
                  style={{ width: "1.5em", height: "1.5em", flexShrink: 0 }}
                  aria-hidden
                />
              ) : (
                <Globe className="size-6 shrink-0" aria-hidden />
              )}
              <PopoverTitle className="min-w-0 truncate text-base">
                {title}
              </PopoverTitle>
            </div>
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Calendar className="size-4 shrink-0" aria-hidden />
              <span>{daysLabel}</span>
            </p>
            {offers && offers.mode !== "none" && !choosing ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setChoosing(true)}
              >
                {offers.mode === "validity" ? t("extendValidity") : t("topUp")}
              </Button>
            ) : null}
          </div>
          {unlimited ? (
            <div className="flex w-28 shrink-0 flex-col items-center gap-1 text-center">
              <InfinityMark label={t("unlimited")} />
              {speedCaption ? (
                <p className="text-xs leading-snug">{speedCaption}</p>
              ) : null}
            </div>
          ) : (
            <DataGauge
              ratio={gaugeRatio}
              center={gaugeCenter}
              label={trigger}
            />
          )}
        </div>
        {choosing && offers?.mode === "packages" ? (
          <PackageChoices
            packages={offers.packages}
            selected={selected}
            locale={locale}
            paying={paying}
            payError={payError}
            onSelect={setSelectedCode}
            onPay={(provider) => {
              if (!selected) return;
              void pay(provider, { packageCode: selected.packageCode });
            }}
            rubPrice={rubPrice}
            usdPrice={usdPrice}
            payErrorText={tCheckout("payFailed")}
            paySbp={(price) => tCheckout("paySbp", { price })}
            payCrypto={(price) => tCheckout("payCrypto", { price })}
          />
        ) : null}
        {choosing && offers?.mode === "validity" ? (
          <div className="mt-3 flex flex-col gap-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>{t("extendDays")}</span>
              <input
                type="number"
                min={1}
                max={365}
                value={days}
                className="border-border bg-background h-8 w-20 rounded-lg border px-2"
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isInteger(next) && next >= 1 && next <= 365) {
                    setDays(next);
                  }
                }}
              />
            </label>
            <PayButtons
              locale={locale}
              paying={paying || quoting || offers.days !== days}
              rub={rubPrice(offers.priceRub)}
              usd={usdPrice(offers.priceUsd)}
              paySbp={(price) => tCheckout("paySbp", { price })}
              payCrypto={(price) => tCheckout("payCrypto", { price })}
              onPay={(provider) => {
                void pay(provider, { days });
              }}
            />
            {payError ? (
              <p className="text-destructive text-center text-sm">
                {tCheckout("payFailed")}
              </p>
            ) : null}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function PackageChoices({
  packages,
  selected,
  locale,
  paying,
  payError,
  onSelect,
  onPay,
  rubPrice,
  usdPrice,
  payErrorText,
  paySbp,
  payCrypto,
}: {
  packages: TopupPackageOffer[];
  selected: TopupPackageOffer | null;
  locale: string;
  paying: boolean;
  payError: boolean;
  onSelect: (packageCode: string) => void;
  onPay: (provider: "trybit" | "xhub") => void;
  rubPrice: (amount: number) => string;
  usdPrice: (amount: number) => string;
  payErrorText: string;
  paySbp: (price: string) => string;
  payCrypto: (price: string) => string;
}) {
  const tCatalog = useTranslations("Catalog");
  return (
    <div className="mt-3 flex max-h-52 flex-col gap-2 overflow-y-auto">
      {packages.map((pkg) => {
        const data = formatByteVolume(BigInt(Math.trunc(pkg.volumeBytes)));
        const price =
          locale === "ru" ? rubPrice(pkg.priceRub) : usdPrice(pkg.priceUsd);
        const active = selected?.packageCode === pkg.packageCode;
        return (
          <button
            key={pkg.packageCode}
            type="button"
            className={`rounded-lg border px-3 py-2 text-left text-sm ${active ? "border-foreground" : "border-border"}`}
            onClick={() => onSelect(pkg.packageCode)}
          >
            <span className="font-medium">{pkg.name}</span>
            <span className="text-muted-foreground block">
              {data}
              {" · "}
              {tCatalog("duration.day", { count: pkg.validityDays })}
              {" · "}
              {price}
            </span>
          </button>
        );
      })}
      {selected ? (
        <PayButtons
          locale={locale}
          paying={paying}
          rub={rubPrice(selected.priceRub)}
          usd={usdPrice(selected.priceUsd)}
          paySbp={paySbp}
          payCrypto={payCrypto}
          onPay={onPay}
        />
      ) : null}
      {payError ? (
        <p className="text-destructive text-center text-sm">{payErrorText}</p>
      ) : null}
    </div>
  );
}

function PayButtons({
  locale,
  paying,
  rub,
  usd,
  paySbp,
  payCrypto,
  onPay,
}: {
  locale: string;
  paying: boolean;
  rub: string;
  usd: string;
  paySbp: (price: string) => string;
  payCrypto: (price: string) => string;
  onPay: (provider: "trybit" | "xhub") => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {locale === "ru" ? (
        <Button
          type="button"
          className="h-10 border border-emerald-900 bg-emerald-700 text-white hover:bg-emerald-800"
          disabled={paying}
          onClick={() => onPay("xhub")}
        >
          <QrCode data-icon="inline-start" className="size-4" />
          {paySbp(rub)}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="h-10"
        disabled={paying}
        onClick={() => onPay("trybit")}
      >
        <Image
          src="/USDT.svg"
          alt=""
          width={16}
          height={16}
          data-icon="inline-start"
          className="size-4 shrink-0"
        />
        {payCrypto(usd)}
      </Button>
    </div>
  );
}
