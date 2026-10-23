import { beforeEach, describe, expect, test } from "bun:test";

import { getSalesSeries } from "~/server/dashboard/get-sales-series";
import { fakeDb } from "~/test/fake-db";
import { resetTestState } from "~/test/mocks";

describe("getSalesSeries", () => {
  beforeEach(() => {
    resetTestState();
  });

  test("loads paid orders in range and aggregates", async () => {
    const now = new Date("2026-09-26T12:00:00.000Z");

    fakeDb.seedOrder({
      paymentStatus: "paid",
      paidAt: new Date("2026-09-25T10:00:00.000Z"),
      priceAmount: 2500n,
      currency: "USD",
    });
    fakeDb.seedOrder({
      paymentStatus: "paid",
      paidAt: new Date("2026-09-10T10:00:00.000Z"),
      priceAmount: 1000n,
      currency: "USD",
    });
    fakeDb.seedOrder({
      paymentStatus: "pending",
      paidAt: null,
      priceAmount: 9999n,
      currency: "USD",
    });
    fakeDb.seedOrder({
      paymentStatus: "paid",
      paidAt: new Date("2026-08-01T10:00:00.000Z"),
      priceAmount: 5000n,
      currency: "USD",
    });

    const series = await getSalesSeries("week", now);
    expect(series).toHaveLength(7);
    const day = series.find((point) => point.key === "2026-09-25");
    expect(day?.orderCount).toBe(1);
    expect(day?.revenueUsd).toBe(25);
    expect(series.every((point) => point.key >= "2026-09-20")).toBe(true);
    expect(series.reduce((sum, point) => sum + point.orderCount, 0)).toBe(1);
  });
  test("keeps paid counts, subtracts refunds, separates RUB, and excludes future payments", async () => {
    const now = new Date("2026-09-26T12:00:00Z");
    const paidAt = new Date("2026-09-25T10:00:00Z");
    fakeDb.seedOrder({
      paidAt,
      paymentStatus: "refunded",
      priceAmount: 2500n,
      refundedAmount: 500n,
      currency: "USD",
    });
    fakeDb.seedOrder({
      paidAt,
      paymentStatus: "refunded",
      priceAmount: 1000n,
      currency: "USD",
    });
    fakeDb.seedOrder({
      paidAt,
      paymentStatus: "chargeback",
      priceAmount: 1000n,
      currency: "USD",
    });
    fakeDb.seedOrder({
      paidAt,
      paymentStatus: "paid",
      priceAmount: 99900n,
      currency: "RUB",
    });
    fakeDb.seedOrder({
      paidAt,
      paymentStatus: "refunded",
      priceAmount: 50000n,
      refundedAmount: 10000n,
      currency: "RUB",
    });
    fakeDb.seedOrder({
      paidAt: new Date("2026-09-26T13:00:00Z"),
      paymentStatus: "paid",
      priceAmount: 100000n,
    });
    fakeDb.seedOrder({
      paidAt: new Date("2026-09-29T13:00:00Z"),
      paymentStatus: "paid",
      priceAmount: 100000n,
    });
    fakeDb.seedOrder({
      paidAt: null,
      paymentStatus: "chargeback",
      priceAmount: 100000n,
    });
    fakeDb.seedOrder({ paidAt, paymentStatus: "failed", priceAmount: 100000n });

    for (const range of ["week", "month", "year"] as const) {
      const series = await getSalesSeries(range, now);
      expect(series.reduce((sum, point) => sum + point.orderCount, 0)).toBe(5);
      expect(series.reduce((sum, point) => sum + point.revenueUsd, 0)).toBe(20);
      expect(series.reduce((sum, point) => sum + point.revenueRub, 0)).toBe(
        1399,
      );
    }
  });
});
