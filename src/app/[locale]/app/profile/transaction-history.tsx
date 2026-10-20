"use client";

import { useState } from "react";
import { ChevronRight, Globe, History } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import ReactCountryFlag from "react-country-flag";

import { OverlayBackToAppButton } from "./overlay-back-to-app";
import { api } from "~/trpc/react";

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

export function TransactionHistory() {
  const t = useTranslations("Profile");
  const tCatalog = useTranslations("Catalog");
  const format = useFormatter();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const history = api.orders.history.useQuery(undefined, { enabled: open });
  const orders = history.data ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          <ChevronRight
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden
          />
        </div>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="data-open:zoom-in-100 data-closed:zoom-out-100 bg-background inset-0 top-0 left-0 flex h-[var(--tg-viewport-stable-height,100dvh)] max-h-[var(--tg-viewport-stable-height,100dvh)] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 text-base ring-0 sm:max-w-none"
      >
        <OverlayBackToAppButton />
        <DialogHeader className="shrink-0 px-4 pt-[max(6rem,calc(var(--tg-safe-area-inset-top,env(safe-area-inset-top,0px))+var(--tg-content-safe-area-inset-top,0px)+3.5rem))] pb-3">
          <DialogTitle className="text-center text-xl leading-snug">
            {t("transactionHistory")}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-4 pb-[max(1.5rem,calc(var(--tg-safe-area-inset-bottom,env(safe-area-inset-bottom,0px))+var(--tg-content-safe-area-inset-bottom,0px)))] [-webkit-overflow-scrolling:touch]">
          <div className="mx-auto flex max-w-lg flex-col gap-3">
            {open && history.isPending ? (
              <div aria-hidden>
                <div className="bg-muted h-16 animate-pulse rounded-xl" />
                <div className="bg-muted mt-3 h-16 animate-pulse rounded-xl" />
              </div>
            ) : history.isSuccess && orders.length === 0 ? (
              <DialogDescription className="text-base">
                {t("transactionHistoryEmpty")}
              </DialogDescription>
            ) : (
              orders.map((order) => {
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
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
