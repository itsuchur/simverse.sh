import { STARS_PAYMENT_PROVIDER } from "~/lib/order-status";
import { USD_PER_STAR } from "~/lib/usd-to-stars";

export const SALES_RANGES = ["week", "month", "year"] as const;

export type SalesRange = (typeof SALES_RANGES)[number];

export type SalesPoint = {
  key: string;
  label: string;
  /** Customer revenue normalized to USD major units. */
  revenueUsd: number;
  orderCount: number;
};

export type SalesOrderRow = {
  priceAmount: bigint;
  currency: string;
  paymentProvider: string;
  paidAt: Date | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function isSalesRange(value: string): value is SalesRange {
  return (SALES_RANGES as readonly string[]).includes(value);
}

export function parseSalesRange(
  value: string | string[] | undefined,
): SalesRange {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && isSalesRange(raw)) {
    return raw;
  }
  return "month";
}

/** Start of UTC calendar day for `date`. */
export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/** Start of UTC calendar month for `date`. */
export function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * Inclusive range window ending at the UTC day/month of `now`.
 * - week: last 7 UTC days (daily buckets)
 * - month: last 30 UTC days (daily buckets)
 * - year: last 12 UTC calendar months (monthly buckets)
 */
export function salesWindow(range: SalesRange, now: Date) {
  if (range === "year") {
    const end = startOfUtcMonth(now);
    const start = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11, 1),
    );
    return { start, end, bucket: "month" as const };
  }

  const end = startOfUtcDay(now);
  const dayCount = range === "week" ? 7 : 30;
  const start = new Date(end.getTime() - (dayCount - 1) * DAY_MS);
  return { start, end, bucket: "day" as const };
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function dayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function emptyBuckets(
  range: SalesRange,
  now: Date,
): Map<string, SalesPoint> {
  const { start, end, bucket } = salesWindow(range, now);
  const points = new Map<string, SalesPoint>();

  if (bucket === "month") {
    for (let cursor = new Date(start); cursor <= end; ) {
      const key = monthKey(cursor);
      points.set(key, {
        key,
        label: monthLabel(cursor),
        revenueUsd: 0,
        orderCount: 0,
      });
      cursor = new Date(
        Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
      );
    }
    return points;
  }

  for (let cursor = new Date(start); cursor <= end; ) {
    const key = dayKey(cursor);
    points.set(key, {
      key,
      label: dayLabel(cursor),
      revenueUsd: 0,
      orderCount: 0,
    });
    cursor = new Date(cursor.getTime() + DAY_MS);
  }
  return points;
}

/**
 * Normalize order price to USD major units.
 * - USD: minor units (cents) → dollars
 * - XTR / Telegram Stars: stars × USD_PER_STAR
 * - RUB: not FX-normalized (historical rate unknown); contributes 0 to USD revenue
 */
export function orderRevenueUsd(order: {
  priceAmount: bigint;
  currency: string;
  paymentProvider: string;
}): number {
  const amount = Number(order.priceAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  const currency = order.currency.toUpperCase();
  if (currency === "USD") {
    return amount / 100;
  }
  if (
    currency === "XTR" ||
    order.paymentProvider === STARS_PAYMENT_PROVIDER
  ) {
    return amount * USD_PER_STAR;
  }
  return 0;
}

export function aggregateSalesSeries(
  orders: SalesOrderRow[],
  range: SalesRange,
  now: Date = new Date(),
): SalesPoint[] {
  const { bucket } = salesWindow(range, now);
  const points = emptyBuckets(range, now);

  for (const order of orders) {
    if (!order.paidAt) {
      continue;
    }
    const key =
      bucket === "month" ? monthKey(order.paidAt) : dayKey(order.paidAt);
    const point = points.get(key);
    if (!point) {
      continue;
    }
    point.orderCount += 1;
    point.revenueUsd += orderRevenueUsd(order);
  }

  return [...points.values()].map((point) => ({
    ...point,
    revenueUsd: Math.round(point.revenueUsd * 100) / 100,
  }));
}
