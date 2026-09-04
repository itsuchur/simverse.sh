import { beforeEach, describe, expect, test } from "bun:test";

import {
  attachInvoiceUrl,
  DRAFT_TTL_MS,
  findOrCreatePendingOrder,
  type PendingOrderDraft,
} from "~/server/orders/draft";
import { fakeDb } from "~/test/fake-db";
import { resetTestState } from "~/test/mocks";

const DRAFT: PendingOrderDraft = {
  userId: "user-1",
  resellerPlanId: "PKG-1",
  packageName: "Test 1GB 7Days",
  countryCode: "US",
  dataAmountMb: 1024,
  validityDays: 7,
  priceAmount: 1099n,
  currency: "USD",
  costAmount: 500n,
  costCurrency: "USD",
  paymentProvider: "trybit",
};

beforeEach(resetTestState);

describe("findOrCreatePendingOrder", () => {
  test("reuses the live pending draft", async () => {
    const first = await findOrCreatePendingOrder(DRAFT);
    const second = await findOrCreatePendingOrder(DRAFT);

    expect(second.id).toBe(first.id);
    expect(await fakeDb.order.findMany({ where: {} })).toHaveLength(1);
  });

  test("concurrent checkouts converge on a single draft", async () => {
    const [a, b] = await Promise.all([
      findOrCreatePendingOrder(DRAFT),
      findOrCreatePendingOrder(DRAFT),
    ]);

    expect(a.id).toBe(b.id);
    expect(await fakeDb.order.findMany({ where: {} })).toHaveLength(1);
  });

  test("expires a stale draft and issues a fresh one", async () => {
    const stale = fakeDb.seedOrder({
      userId: DRAFT.userId,
      resellerPlanId: DRAFT.resellerPlanId,
      paymentProvider: DRAFT.paymentProvider,
      paymentInvoiceUrl: "https://pay.example/old",
      createdAt: new Date(Date.now() - DRAFT_TTL_MS - 1_000),
    });

    const fresh = await findOrCreatePendingOrder(DRAFT);

    expect(fresh.id).not.toBe(stale.id);
    expect(fresh.paymentInvoiceUrl).toBeNull();
    expect(stale.status).toBe("failed");
    expect(stale.paymentStatus).toBe("failed");
    expect(stale.failureReason).toBe("expired");
  });

  test("stores buyer IP on create and keeps it when reusing", async () => {
    const first = await findOrCreatePendingOrder({
      ...DRAFT,
      buyerIp: "203.0.113.10",
    });
    const second = await findOrCreatePendingOrder({
      ...DRAFT,
      buyerIp: "198.51.100.20",
    });

    expect(second.id).toBe(first.id);
    expect(first.buyerIp).toBe("203.0.113.10");
    expect(second.buyerIp).toBe("203.0.113.10");
  });
});

describe("attachInvoiceUrl", () => {
  test("first invoice wins; later ones return the stored link", async () => {
    const order = fakeDb.seedOrder({});

    const [a, b] = await Promise.all([
      attachInvoiceUrl(order.id, "https://pay.example/a"),
      attachInvoiceUrl(order.id, "https://pay.example/b"),
    ]);

    expect(a).toBe("https://pay.example/a");
    expect(b).toBe("https://pay.example/a");
    expect(order.paymentInvoiceUrl).toBe("https://pay.example/a");
  });
});
