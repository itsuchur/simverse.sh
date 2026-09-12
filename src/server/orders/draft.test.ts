import { beforeEach, describe, expect, test } from "bun:test";

import {
  createPendingInvoice,
  failPendingInvoice,
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

describe("createPendingInvoice", () => {
  test("only one concurrent request calls the provider", async () => {
    const order = fakeDb.seedOrder();
    let finish!: (url: string) => void;
    let started!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const first = createPendingInvoice(order.id, () => {
      started();
      return new Promise<string>((resolve) => {
        finish = resolve;
      });
    });
    await entered;
    const second = await createPendingInvoice(order.id, async () => {
      throw new Error("must not call provider");
    });
    expect(second).toBeNull();
    finish("https://pay.example/a");
    expect(await first).toBe("https://pay.example/a");
    expect(
      await createPendingInvoice(order.id, async () => {
        throw new Error("must reuse");
      }),
    ).toBe("https://pay.example/a");
    expect(order.paymentStatus).toBe("pending");
  });

  test("a failed owning request closes its draft", async () => {
    const order = fakeDb.seedOrder();
    expect(
      await createPendingInvoice(order.id, async () => {
        throw new Error("provider timeout");
      }).catch((error: unknown) => error),
    ).toEqual(new Error("provider timeout"));
    expect(order.paymentStatus).toBe("failed");
    expect(
      await createPendingInvoice(order.id, async () => "unreachable").catch(
        (error: unknown) => error,
      ),
    ).toEqual(new Error("invoice_closed"));
  });

  test("an expired claim cannot publish a late invoice", async () => {
    const order = fakeDb.seedOrder();
    expect(
      await createPendingInvoice(order.id, async () => {
        await failPendingInvoice(order.id, "expired");
        return "https://pay.example/late";
      }).catch((error: unknown) => error),
    ).toEqual(new Error("invoice_closed"));
    expect(order.paymentInvoiceUrl).toBeNull();
  });

  test("a replaced cart does not reuse the old cart revision", async () => {
    const first = await findOrCreatePendingOrder({
      ...DRAFT,
      cartRevision: crypto.randomUUID(),
    });
    const revision = crypto.randomUUID();
    const next = await findOrCreatePendingOrder({
      ...DRAFT,
      cartRevision: revision,
    });
    expect(next.id).not.toBe(first.id);
    expect(next.cartRevision).toBe(revision);
  });
});
