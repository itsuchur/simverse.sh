"use client";

import { useEffect, useState } from "react";
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
import { lpaCardData } from "~/lib/esim-provisioning";
import { orderStatus } from "~/lib/order-status";
import {
  detectEsimInstallPlatform,
  prepareTelegramWebApp,
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
  failureReason: string | null;
  esimIccid: string | null;
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

function isPreparing(order: MyEsimOrder) {
  if (order.esimIccid || order.status === orderStatus.failed) {
    return false;
  }
  if (
    order.status !== orderStatus.paid &&
    order.status !== orderStatus.ordering
  ) {
    return false;
  }
  const age = Date.now() - new Date(order.createdAt).getTime();
  return age < 15 * 60 * 1000;
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
        <CardDescription className="text-base">
          {[data, duration].filter(Boolean).join(" · ")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {order.status === orderStatus.failed ? (
          <p className="text-destructive text-base">{t("failed")}</p>
        ) : order.esimIccid ? (
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

export function MyEsimList({ orders }: { orders: MyEsimOrder[] }) {
  const t = useTranslations("MyEsims");
  const router = useRouter();
  const preparing = orders.some(isPreparing);
  const [platform, setPlatform] = useState<EsimInstallPlatform | null>(null);

  useEffect(() => {
    prepareTelegramWebApp();
    setPlatform(detectEsimInstallPlatform());
  }, []);

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
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription className="text-base">
            {t("description")}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      {orders.map((order) => (
        <OrderCard
          key={order.orderUuid}
          order={order}
          platform={platform}
        />
      ))}
    </div>
  );
}
