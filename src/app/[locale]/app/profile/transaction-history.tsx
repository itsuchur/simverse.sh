"use client";

import { Globe, History } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import ReactCountryFlag from "react-country-flag";

import { Card, CardDescription, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  isStarsOrderPrice,
  orderPriceMajorUnits,
} from "~/lib/format-order-price";

export type HistoryOrder = {
  orderUuid: string;
  packageName: string;
  countryCode: string | null;
  dataAmountMb: number | null;
  validityDays: number;
  priceAmount: string;
  currency: string;
  paymentProvider: string;
  purchasedAt: string;
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

function isSingleCountryCode(
  countryCode: string | null,
): countryCode is string {
  return Boolean(countryCode && !countryCode.includes(","));
}

export function TransactionHistory({ orders }: { orders: HistoryOrder[] }) {
  const t = useTranslations("Profile");
  const tCatalog = useTranslations("Catalog");
  const format = useFormatter();
  const locale = useLocale();

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Card
            size="sm"
            className="hover:bg-muted/40 w-full cursor-pointer transition-colors"
          />
        }
      >
        <div className="flex items-center gap-3 px-(--card-spacing)">
          <span className="bg-muted text-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
            <History className="size-4" aria-hidden />
          </span>
          <CardTitle className="min-w-0 flex-1">
            {t("transactionHistory")}
          </CardTitle>
        </div>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(88vh,42rem)] flex-col gap-0 overflow-hidden p-0 text-base sm:max-w-md">
        <DialogHeader className="shrink-0 px-6 pt-7 pr-14 pb-4">
          <DialogTitle className="text-lg leading-snug">
            {t("transactionHistory")}
          </DialogTitle>
          {orders.length === 0 ? (
            <DialogDescription className="text-base">
              {t("transactionHistoryEmpty")}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {orders.length > 0 ? (
          <div className="[max-height:calc(min(88vh,42rem)-5.75rem)] min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-6 pb-6 [-webkit-overflow-scrolling:touch]">
            <div className="flex flex-col gap-3">
              {orders.map((order) => {
                const data = formatData(order.dataAmountMb);
                const duration = tCatalog("duration.day", {
                  count: order.validityDays,
                });
                const title = isSingleCountryCode(order.countryCode)
                  ? countryDisplayName(order.countryCode, locale)
                  : order.packageName;
                const purchasedAt = new Date(order.purchasedAt);
                const amount = isStarsOrderPrice(order.paymentProvider)
                  ? t("starsAmount", { amount: order.priceAmount })
                  : format.number(
                      orderPriceMajorUnits(BigInt(order.priceAmount)),
                      {
                        style: "currency",
                        currency: order.currency,
                      },
                    );

                return (
                  <Card key={order.orderUuid} size="sm">
                    <div className="flex items-start gap-3 px-(--card-spacing)">
                      {isSingleCountryCode(order.countryCode) ? (
                        <ReactCountryFlag
                          countryCode={order.countryCode}
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
                      <div className="min-w-0 flex-1">
                        <CardTitle className="leading-snug">{title}</CardTitle>
                        <CardDescription className="text-base">
                          {[data, duration].filter(Boolean).join(" · ")}
                        </CardDescription>
                        <CardDescription>
                          {format.dateTime(purchasedAt, {
                            dateStyle: "medium",
                          })}
                        </CardDescription>
                      </div>
                      <p className="text-foreground shrink-0 text-base font-medium">
                        {amount}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
