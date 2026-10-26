"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import ReactCountryFlag from "react-country-flag";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { useRouter } from "~/i18n/navigation";
import {
  esimLifecycleView,
  formatByteVolume,
  remainingValidityDays,
  type LifecycleFocus,
} from "~/lib/esim-lifecycle";
import {
  isStarsOrderPrice,
  orderPriceMajorUnits,
} from "~/lib/format-order-price";
import { hasEsimCredentials, lpaCardData } from "~/lib/esim-provisioning";
import { esimStatusBadge } from "~/lib/esim-status";
import { needsDeliveryRefresh } from "~/lib/order-delivery";
import { orderStatus, paymentStatus } from "~/lib/order-status";
import {
  detectEsimInstallPlatform,
  type EsimInstallPlatform,
} from "~/lib/telegram-webapp";
import { isFupPackageName } from "~/server/suppliers/esimaccess/parse-package-name";

import { InstallationGuide } from "./installation-guide";
import { UsagePanel } from "./usage-panel";

export type MyEsimOrder = {
  orderUuid: string;
  packageName: string;
  countryCode: string | null;
  dataAmountMb: number | null;
  validityDays: number;
  status: string;
  paymentStatus: string;
  failureReason: string | null;
  esimIccid: string | null;
  esimStatus: string | null;
  esimSmdpStatus: string | null;
  esimActivationCode: string | null;
  esimQrUrl: string | null;
  esimSmdpAddress: string | null;
  firstActivatedAt: string | null;
  dataTotalBytes: string | null;
  dataUsedBytes: string | null;
  expiresAt: string | null;
  usageSyncedAt: string | null;
  priceAmount: string;
  currency: string;
  paymentProvider: string;
  paidAt: string | null;
  createdAt: string;
};

function formatData(mb: number | null) {
  if (mb === null) return null;
  if (mb >= 1024) {
    const gb = mb / 1024;
    return Number.isInteger(gb) ? `${gb} GB` : `${gb.toFixed(1)} GB`;
  }
  return `${mb} MB`;
}

function remainingByteVolume(
  totalSource: string | null,
  usedSource: string | null,
) {
  if (!totalSource || usedSource === null) return null;
  try {
    const total = BigInt(totalSource);
    const used = BigInt(usedSource);
    const remaining = total - used;
    return formatByteVolume(remaining < 0n ? 0n : remaining);
  } catch {
    return null;
  }
}

function orderSummaryData(order: MyEsimOrder, unlimitedLabel: string) {
  if (isFupPackageName(order.packageName)) return unlimitedLabel;
  return (
    remainingByteVolume(order.dataTotalBytes, order.dataUsedBytes) ??
    formatData(order.dataAmountMb)
  );
}

function formatPurchaseDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function purchaseCaption(order: MyEsimOrder, locale: string) {
  if (order.paymentStatus !== paymentStatus.paid) return null;
  const date = formatPurchaseDate(order.paidAt ?? order.createdAt, locale);
  if (!date) return null;
  const stars = isStarsOrderPrice(order.paymentProvider);
  const amount = BigInt(order.priceAmount);
  const price = stars
    ? amount.toString()
    : orderPriceMajorUnits(amount).toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
  return {
    date,
    price,
    currency: stars ? "Stars" : order.currency.trim(),
  };
}

function formatTimestamp(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function LifecycleNotice({
  order,
  focus,
}: {
  order: MyEsimOrder;
  focus: LifecycleFocus;
}) {
  const t = useTranslations("MyEsims");
  const tStatus = useTranslations("EsimStatus");
  const locale = useLocale();
  if (focus.kind === "install") return null;

  const expiryDate =
    focus.kind === "expired" && focus.expiresAt
      ? formatTimestamp(focus.expiresAt, locale)
      : null;

  const panel =
    focus.kind === "remaining" ||
    focus.kind === "usageUnavailable" ||
    focus.kind === "exhausted";

  return (
    <div className="flex flex-col gap-1">
      {panel ? <UsagePanel order={order} focus={focus} /> : null}
      {focus.kind === "cancelled" ? (
        <p className="text-base font-semibold">{tStatus("cancelled")}</p>
      ) : null}
      {focus.kind === "expired" ? (
        <>
          <p className="text-base font-semibold">
            {focus.unused ? t("expiredBeforeActivation") : tStatus("expired")}
          </p>
          {expiryDate ? (
            <p className="text-base">{t("expiredOn", { date: expiryDate })}</p>
          ) : (
            <p className="text-muted-foreground text-base">
              {t("expiryDateUnavailable")}
            </p>
          )}
          {focus.dataExhausted ? (
            <p className="text-base">{t("dataExhausted")}</p>
          ) : null}
        </>
      ) : null}
      {focus.kind === "remaining" || focus.kind === "usageUnavailable" ? (
        <p className="text-muted-foreground text-base">{t("usageDelayed")}</p>
      ) : null}
    </div>
  );
}

function InstallationDetails({
  order,
  platform,
  collapsed,
}: {
  order: MyEsimOrder;
  platform: EsimInstallPlatform | null;
  collapsed: boolean;
}) {
  const t = useTranslations("MyEsims");
  const details = (
    <>
      {order.esimQrUrl ? (
        // Supplier QR URLs are short-lived HTTPS assets.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={order.esimQrUrl}
          alt={t("qrAlt")}
          className="border-border mx-auto size-48 rounded-xl border bg-white p-2"
        />
      ) : null}
      <InstallationGuide
        platform={platform}
        cardData={lpaCardData(order.esimSmdpAddress, order.esimActivationCode)}
      />
    </>
  );

  if (!collapsed) {
    return <div className="flex flex-col gap-4">{details}</div>;
  }

  return (
    <details>
      <summary className="cursor-pointer text-base font-medium">
        {t("showInstallationDetails")}
      </summary>
      <div className="mt-4 flex flex-col gap-4">{details}</div>
    </details>
  );
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

function OrderCard({
  order,
  platform,
}: {
  order: MyEsimOrder;
  platform: EsimInstallPlatform | null;
}) {
  const t = useTranslations("MyEsims");
  const tStatus = useTranslations("EsimStatus");
  const tCatalog = useTranslations("Catalog");
  const locale = useLocale();
  const data = orderSummaryData(order, t("unlimited"));
  const duration = tCatalog("duration.day", {
    count: remainingValidityDays(order),
  });
  const countryCode = order.countryCode;
  const title =
    countryCode && !countryCode.includes(",")
      ? countryDisplayName(countryCode, locale)
      : order.packageName;
  const statusBadge = esimStatusBadge(order.esimStatus, order.esimSmdpStatus);
  const lifecycle = esimLifecycleView(order);
  const purchased = purchaseCaption(order, locale);
  const usageUpdatedAt =
    lifecycle.focus.kind === "remaining" ||
    lifecycle.focus.kind === "usageUnavailable"
      ? lifecycle.focus.usageSyncedAt
        ? formatTimestamp(lifecycle.focus.usageSyncedAt, locale)
        : null
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg">
          {countryCode && !countryCode.includes(",") ? (
            <ReactCountryFlag
              countryCode={countryCode}
              svg
              style={{
                width: "1.75em",
                height: "1.75em",
                flexShrink: 0,
                display: "block",
              }}
              aria-label={title}
            />
          ) : (
            <Globe className="size-7 shrink-0" aria-hidden />
          )}
          <span className="min-w-0">{title}</span>
        </CardTitle>
        <div className="flex flex-col gap-1">
          <CardDescription className="text-base">
            {[data, duration].filter(Boolean).join(" · ")}
          </CardDescription>
          {order.esimIccid && statusBadge ? (
            <span
              className={`text-foreground w-fit rounded-lg px-2 py-1 text-xs font-bold tracking-wide ${statusBadge.className}`}
            >
              {statusBadge.label
                ? tStatus(statusBadge.label)
                : statusBadge.text}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {order.status === orderStatus.refundRequired ? (
          <p className="text-destructive text-base">{t("paymentReview")}</p>
        ) : order.paymentStatus === paymentStatus.refunded ||
        order.paymentStatus === paymentStatus.chargeback ? (
          <p className="text-muted-foreground text-base">{t("reversed")}</p>
        ) : order.paymentStatus === paymentStatus.pending ? (
          <p className="text-muted-foreground text-base">
            {t("awaitingPayment")}
          </p>
        ) : order.status === orderStatus.failed &&
          order.paymentStatus !== paymentStatus.paid ? (
          <p className="text-destructive text-base">{t("failed")}</p>
        ) : hasEsimCredentials(order) ? (
          <>
            <LifecycleNotice order={order} focus={lifecycle.focus} />
            <InstallationDetails
              order={order}
              platform={platform}
              collapsed={lifecycle.collapseInstall}
            />
          </>
        ) : (
          <p className="text-muted-foreground text-base">{t("preparing")}</p>
        )}
        {usageUpdatedAt || purchased ? (
          <div className="flex flex-col gap-1">
            {usageUpdatedAt ? (
              <p className="text-muted-foreground text-sm">
                {t("usageUpdatedAt", { time: usageUpdatedAt })}
              </p>
            ) : null}
            {purchased ? (
              <p className="text-muted-foreground text-sm">
                {t("purchasedOn", purchased)}
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function subscribeNever() {
  return () => undefined;
}

export function MyEsimList({
  orders,
  refreshLifecycle = false,
}: {
  orders: MyEsimOrder[];
  refreshLifecycle?: boolean;
}) {
  const t = useTranslations("MyEsims");
  const router = useRouter();
  const preparing = orders.some(needsDeliveryRefresh);
  const lifecycleRefreshes = useRef(0);
  // Platform never changes during a session; the store only exists to read it
  // client-side (null during SSR/hydration).
  const platform = useSyncExternalStore<EsimInstallPlatform | null>(
    subscribeNever,
    detectEsimInstallPlatform,
    () => null,
  );

  useEffect(() => {
    if (!preparing) return;
    const id = window.setInterval(() => {
      router.refresh();
    }, 3000);
    return () => window.clearInterval(id);
  }, [preparing, router]);

  useEffect(() => {
    if (!refreshLifecycle) return;
    const id = window.setInterval(() => {
      if (lifecycleRefreshes.current >= 3) {
        window.clearInterval(id);
        return;
      }
      lifecycleRefreshes.current += 1;
      router.refresh();
    }, 3000);
    return () => window.clearInterval(id);
  }, [refreshLifecycle, router]);

  if (orders.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <div aria-hidden="true">
          <DotLottieReact
            src="https://fonts.gstatic.com/s/e/notoemoji/latest/1fae3/lottie.json"
            loop
            autoplay
            className="size-48"
          />
        </div>
        <p className="text-muted-foreground max-w-sm text-base">
          {t("description")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {orders.map((order) => (
        <OrderCard key={order.orderUuid} order={order} platform={platform} />
      ))}
    </div>
  );
}
