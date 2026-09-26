import { describe, expect, test } from "bun:test";

import {
  aggregateSalesSeries,
  orderRevenueUsd,
  parseSalesRange,
  salesWindow,
  startOfUtcDay,
  startOfUtcMonth,
} from "./sales-series";

describe("parseSalesRange", () => {
  test("defaults to month", () => {
    expect(parseSalesRange(undefined)).toBe("month");
    expect(parseSalesRange("nope")).toBe("month");
  });

  test("accepts week month year", () => {
    expect(parseSalesRange("week")).toBe("week");
    expect(parseSalesRange("month")).toBe("month");
    expect(parseSalesRange("year")).toBe("year");
    expect(parseSalesRange(["week"])).toBe("week");
  });
});

describe("salesWindow", () => {
  const now = new Date("2026-09-26T15:30:00.000Z");

  test("week spans 7 UTC days ending today", () => {
    const { start, end, bucket } = salesWindow("week", now);
    expect(bucket).toBe("day");
    expect(end.toISOString()).toBe("2026-09-26T00:00:00.000Z");
    expect(start.toISOString()).toBe("2026-09-20T00:00:00.000Z");
  });

  test("month spans 30 UTC days ending today", () => {
    const { start, end, bucket } = salesWindow("month", now);
    expect(bucket).toBe("day");
    expect(end.toISOString()).toBe("2026-09-26T00:00:00.000Z");
    expect(start.toISOString()).toBe("2026-08-28T00:00:00.000Z");
  });

  test("year spans 12 UTC calendar months ending this month", () => {
    const { start, end, bucket } = salesWindow("year", now);
    expect(bucket).toBe("month");
    expect(end.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(start.toISOString()).toBe("2025-10-01T00:00:00.000Z");
  });
});

describe("orderRevenueUsd", () => {
  test("converts USD cents to dollars", () => {
    expect(
      orderRevenueUsd({
        priceAmount: 1099n,
        currency: "USD",
        paymentProvider: "trybit",
      }),
    ).toBe(10.99);
  });

  test("converts Stars with USD_PER_STAR", () => {
    expect(
      orderRevenueUsd({
        priceAmount: 100n,
        currency: "XTR",
        paymentProvider: "telegram_stars",
      }),
    ).toBe(3);
  });

  test("RUB does not contribute to USD revenue without FX", () => {
    expect(
      orderRevenueUsd({
        priceAmount: 99900n,
        currency: "RUB",
        paymentProvider: "cardlink",
      }),
    ).toBe(0);
  });
});

describe("aggregateSalesSeries", () => {
  const now = new Date("2026-09-26T12:00:00.000Z");

  test("fills empty week buckets and sums revenue and order count", () => {
    const series = aggregateSalesSeries(
      [
        {
          priceAmount: 1000n,
          currency: "USD",
          paymentProvider: "trybit",
          paidAt: new Date("2026-09-26T08:00:00.000Z"),
        },
        {
          priceAmount: 500n,
          currency: "USD",
          paymentProvider: "cardlink",
          paidAt: new Date("2026-09-26T09:00:00.000Z"),
        },
        {
          priceAmount: 200n,
          currency: "XTR",
          paymentProvider: "telegram_stars",
          paidAt: new Date("2026-09-20T01:00:00.000Z"),
        },
        {
          priceAmount: 99900n,
          currency: "RUB",
          paymentProvider: "cardlink",
          paidAt: new Date("2026-09-21T01:00:00.000Z"),
        },
        {
          priceAmount: 1000n,
          currency: "USD",
          paymentProvider: "trybit",
          paidAt: new Date("2026-09-19T23:00:00.000Z"),
        },
      ],
      "week",
      now,
    );

    expect(series).toHaveLength(7);
    expect(series[0]?.key).toBe("2026-09-20");
    expect(series[0]?.orderCount).toBe(1);
    expect(series[0]?.revenueUsd).toBe(6);
    expect(series[1]?.key).toBe("2026-09-21");
    expect(series[1]?.orderCount).toBe(1);
    expect(series[1]?.revenueUsd).toBe(0);
    expect(series[6]?.key).toBe("2026-09-26");
    expect(series[6]?.orderCount).toBe(2);
    expect(series[6]?.revenueUsd).toBe(15);
  });

  test("year buckets by UTC month", () => {
    const series = aggregateSalesSeries(
      [
        {
          priceAmount: 2000n,
          currency: "USD",
          paymentProvider: "trybit",
          paidAt: new Date("2026-09-15T00:00:00.000Z"),
        },
        {
          priceAmount: 1000n,
          currency: "USD",
          paymentProvider: "trybit",
          paidAt: new Date("2025-10-02T00:00:00.000Z"),
        },
      ],
      "year",
      now,
    );

    expect(series).toHaveLength(12);
    expect(series[0]?.key).toBe("2025-10");
    expect(series[0]?.orderCount).toBe(1);
    expect(series[0]?.revenueUsd).toBe(10);
    expect(series[11]?.key).toBe("2026-09");
    expect(series[11]?.orderCount).toBe(1);
    expect(series[11]?.revenueUsd).toBe(20);
  });

  test("startOfUtc helpers truncate correctly", () => {
    expect(startOfUtcDay(now).toISOString()).toBe("2026-09-26T00:00:00.000Z");
    expect(startOfUtcMonth(now).toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });
});
