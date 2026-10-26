"use client";

import { useState } from "react";
import { ChevronRight, Globe, History } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import ReactCountryFlag from "react-country-flag";

import { OverlayBackToAppButton } from "./overlay-back-to-app";
import { api } from "~/trpc/react";

import { Card, CardTitle } from "~/components/ui/card";
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
import { isFupPackageName } from "~/server/suppliers/esimaccess/parse-package-name";

export type HistoryOrder = {
  id: string;
  orderUuid: string;
  isTopup: boolean;
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

const documentTitleClassName =
  "w-full max-w-4xl text-center text-5xl leading-tight font-extrabold tracking-tight text-balance sm:text-6xl md:text-7xl";

export function TransactionHistory() {
  const t = useTranslations("Profile");
  const tCatalog = useTranslations("Catalog");
  const tMyEsims = useTranslations("MyEsims");
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
        className="data-open:zoom-in-100 data-closed:zoom-out-100 bg-background inset-0 top-0 left-0 flex h-[var(--tg-viewport-stable-height,100dvh)] max-h-[var(--tg-viewport-stable-height,100dvh)] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 ring-0 sm:max-w-none"
      >
        <OverlayBackToAppButton />
        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-6 pt-[max(6rem,calc(var(--tg-safe-area-inset-top,env(safe-area-inset-top,0px))+var(--tg-content-safe-area-inset-top,0px)+3.5rem))] pb-[max(1.5rem,calc(var(--tg-safe-area-inset-bottom,env(safe-area-inset-bottom,0px))+var(--tg-content-safe-area-inset-bottom,0px)))] [-webkit-overflow-scrolling:touch]">
          <div className="mx-auto flex w-full flex-col items-center">
            <DialogHeader className="w-full">
              <DialogTitle className={documentTitleClassName}>
                {t("transactionHistory")}
              </DialogTitle>
            </DialogHeader>
            <article className="text-muted-foreground mt-12 w-full max-w-2xl text-sm leading-6 sm:mt-16">
              {open && history.isPending ? (
                <div aria-hidden className="space-y-3">
                  <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
                  <div className="bg-muted h-4 animate-pulse rounded" />
                  <div className="bg-muted mt-8 h-4 w-1/2 animate-pulse rounded" />
                  <div className="bg-muted h-4 animate-pulse rounded" />
                </div>
              ) : history.isSuccess && orders.length === 0 ? (
                <DialogDescription>
                  {t("transactionHistoryEmpty")}
                </DialogDescription>
              ) : (
                <ul className="space-y-8">
                  {orders.map((order) => {
                    const data = isFupPackageName(order.packageName)
                      ? tMyEsims("unlimited")
                      : formatData(order.dataAmountMb);
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
                      <li key={order.orderUuid} className="flex gap-3">
                        {isSingleCountryCode(order.countryCode) ? (
                          <ReactCountryFlag
                            countryCode={order.countryCode}
                            svg
                            style={{
                              width: "1.25em",
                              height: "1.25em",
                              flexShrink: 0,
                              display: "block",
                              marginTop: "0.15em",
                            }}
                            aria-label={title}
                          />
                        ) : (
                          <Globe
                            className="mt-0.5 size-4 shrink-0"
                            aria-hidden
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p>
                            {order.isTopup
                              ? t("transactionTopup")
                              : t("transactionEsimPurchase")}
                          </p>
                          <p>
                            {tMyEsims("orderNumber", {
                              orderNumber: order.id,
                            })}
                          </p>
                          <p className="text-foreground font-semibold">
                            {title}
                          </p>
                          <p>{[data, duration].filter(Boolean).join(" · ")}</p>
                          <p>
                            {format.dateTime(purchasedAt, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </p>
                        </div>
                        <p className="text-foreground shrink-0 font-semibold">
                          {amount}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
