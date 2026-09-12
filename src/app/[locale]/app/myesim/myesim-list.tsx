"use client";

import { useEffect, useSyncExternalStore } from "react";
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
import { hasEsimCredentials, lpaCardData } from "~/lib/esim-provisioning";
import { esimStatusBadge } from "~/lib/esim-status";
import { needsDeliveryRefresh } from "~/lib/order-delivery";
import { orderStatus, paymentStatus } from "~/lib/order-status";
import {
  detectEsimInstallPlatform,
  type EsimInstallPlatform,
} from "~/lib/telegram-webapp";

import { InstallationGuide } from "./installation-guide";

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
  const tCatalog = useTranslations("Catalog");
  const locale = useLocale();
  const data = formatData(order.dataAmountMb);
  const duration = tCatalog("duration.day", { count: order.validityDays });
  const countryCode = order.countryCode;
  const title =
    countryCode && !countryCode.includes(",")
      ? countryDisplayName(countryCode, locale)
      : order.packageName;
  const statusBadge = esimStatusBadge(order.esimStatus, order.esimSmdpStatus);

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
              {statusBadge.text}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {order.paymentStatus === paymentStatus.refunded ||
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
              cardData={lpaCardData(
                order.esimSmdpAddress,
                order.esimActivationCode,
              )}
            />
          </>
        ) : (
          <p className="text-muted-foreground text-base">{t("preparing")}</p>
        )}
      </CardContent>
    </Card>
  );
}

function subscribeNever() {
  return () => undefined;
}

export function MyEsimList({ orders }: { orders: MyEsimOrder[] }) {
  const t = useTranslations("MyEsims");
  const router = useRouter();
  const preparing = orders.some(needsDeliveryRefresh);
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

  if (orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardDescription className="text-base">
            {t("description")}
          </CardDescription>
        </CardHeader>
      </Card>
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
