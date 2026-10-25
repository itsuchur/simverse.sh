/* Bun's async matcher types omit Promise even though these assertions must be awaited. */
/* eslint-disable @typescript-eslint/await-thenable */
import { beforeEach, expect, mock, spyOn, test } from "bun:test";
import { createPendingInvoice, failPendingInvoice } from "./draft";
import { XHUB_RESERVATION_TTL_MS } from "./supplier-capacity";
import { checkBalance } from "~/server/suppliers/esimaccess/balance-check";
import { fakeDb } from "~/test/fake-db";
import { esimAccessPost, resetTestState } from "~/test/mocks";

beforeEach(() => {
  resetTestState();
  esimAccessPost.mockResolvedValue({ success: true, obj: { balance: 500 } });
});

const create = () =>
  Promise.resolve({ url: "https://pay.example/invoice", id: "invoice" });

test("concurrent X-Hub and Trybit checkouts cannot spend the same capacity", async () => {
  const a = fakeDb.seedOrder({ paymentProvider: "xhub", costAmount: 500n });
  const b = fakeDb.seedOrder({ paymentProvider: "trybit", costAmount: 500n });
  const provider = mock(create);
  const results = await Promise.allSettled([
    createPendingInvoice(a.id, provider),
    createPendingInvoice(b.id, provider),
  ]);
  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  expect(provider).toHaveBeenCalledTimes(1);
  expect(
    [a, b].filter((order) => order.paymentInvoiceClaim !== null),
  ).toHaveLength(1);
});

test("a stale cached balance cannot authorize an invoice", async () => {
  esimAccessPost.mockResolvedValue({
    success: true,
    obj: { balance: 100_000 },
  });
  await checkBalance();
  esimAccessPost.mockResolvedValue({ success: true, obj: { balance: 499 } });
  const order = fakeDb.seedOrder();
  const provider = mock(create);
  await expect(createPendingInvoice(order.id, provider)).rejects.toThrow(
    "insufficient_supplier_balance",
  );
  expect(provider).not.toHaveBeenCalled();
  expect(order.paymentInvoiceClaim).toBeNull();
});

for (const balance of [
  NaN,
  Infinity,
  -1,
  500.5,
  Number.MAX_SAFE_INTEGER + 1,
  "500",
  null,
]) {
  test(`invalid balance ${String(balance)} fails closed`, async () => {
    esimAccessPost.mockResolvedValue({ success: true, obj: { balance } });
    const order = fakeDb.seedOrder();
    const provider = mock(create);
    await expect(createPendingInvoice(order.id, provider)).rejects.toThrow();
    expect(provider).not.toHaveBeenCalled();
    expect(order.paymentInvoiceClaim).toBeNull();
  });
}

test("supplier outage rolls back the reservation and allows a later retry", async () => {
  const order = fakeDb.seedOrder();
  const provider = mock(create);
  esimAccessPost.mockRejectedValue(new Error("offline"));
  await expect(createPendingInvoice(order.id, provider)).rejects.toThrow(
    "offline",
  );
  expect(order.paymentInvoiceClaim).toBeNull();
  expect(provider).not.toHaveBeenCalled();
  esimAccessPost.mockResolvedValue({ success: true, obj: { balance: 500 } });
  await expect(createPendingInvoice(order.id, provider)).resolves.toBe(
    "https://pay.example/invoice",
  );
});

test("local expiry does not free capacity for a still-payable invoice", async () => {
  const old = fakeDb.seedOrder();
  await createPendingInvoice(old.id, create);
  await failPendingInvoice(old.id, "expired");
  const next = fakeDb.seedOrder();
  await expect(createPendingInvoice(next.id, create)).rejects.toThrow(
    "insufficient_supplier_balance",
  );
});

test("unknown invoice creation outcomes retain capacity", async () => {
  const old = fakeDb.seedOrder();
  await expect(
    createPendingInvoice(old.id, async () => {
      throw new Error("timeout");
    }),
  ).rejects.toThrow("timeout");
  const next = fakeDb.seedOrder();
  await expect(createPendingInvoice(next.id, create)).rejects.toThrow(
    "insufficient_supplier_balance",
  );
});

for (const liability of [
  { paymentInvoiceUrl: "https://pay.example/legacy" },
  { paymentStatus: "paid", status: "failed" },
  {
    paymentStatus: "paid",
    status: "ordering",
    topupOfOrderId: 100n,
    resellerOrderId: "parent",
  },
]) {
  test(`counts existing liability ${JSON.stringify(liability, (_, v: unknown) => (typeof v === "bigint" ? String(v) : v))}`, async () => {
    fakeDb.seedOrder(liability);
    const next = fakeDb.seedOrder();
    await expect(createPendingInvoice(next.id, create)).rejects.toThrow(
      "insufficient_supplier_balance",
    );
  });
}

test("fulfilled purchases and top-ups no longer reserve an already-debited cost", async () => {
  fakeDb.seedOrder({
    paymentStatus: "paid",
    status: "ordering",
    resellerOrderId: "EA-1",
  });
  fakeDb.seedOrder({
    paymentStatus: "paid",
    status: "issued",
    topupOfOrderId: 100n,
  });
  const next = fakeDb.seedOrder({ topupOfOrderId: 100n });
  await expect(createPendingInvoice(next.id, create)).resolves.toBe(
    "https://pay.example/invoice",
  );
});

test("existing invoice reuse does not reserve twice", async () => {
  const order = fakeDb.seedOrder();
  const provider = mock(create);
  await createPendingInvoice(order.id, provider);
  await createPendingInvoice(order.id, provider);
  expect(provider).toHaveBeenCalledTimes(1);
});

for (const paymentStatus of ["pending", "failed"]) {
  test(`X-Hub ${paymentStatus} reservation expires exactly at ten minutes`, async () => {
    const now = Date.now();
    const clock = spyOn(Date, "now").mockReturnValue(now);
    try {
      const old = fakeDb.seedOrder({
        paymentProvider: "xhub",
        paymentStatus,
        status: paymentStatus === "failed" ? "failed" : "created",
        paymentInvoiceClaim: "attempted",
        createdAt: new Date(now - XHUB_RESERVATION_TTL_MS + 1),
      });
      const next = fakeDb.seedOrder();
      await expect(createPendingInvoice(next.id, create)).rejects.toThrow(
        "insufficient_supplier_balance",
      );
      clock.mockReturnValue(now + 1);
      // Reconciliation updates must not renew the reservation.
      old.updatedAt = new Date(now + 1);
      await expect(createPendingInvoice(next.id, create)).resolves.toBe(
        "https://pay.example/invoice",
      );
      expect(old.paymentInvoiceClaim).toBe("attempted");
      expect(old.paymentStatus).toBe(paymentStatus);
    } finally {
      clock.mockRestore();
    }
  });
}

for (const topupOfOrderId of [null, 100n]) {
  test(`paid X-Hub ${topupOfOrderId ? "top-up" : "purchase"} keeps its reservation after ten minutes`, async () => {
    fakeDb.seedOrder({
      paymentProvider: "xhub",
      paymentStatus: "paid",
      status: "ordering",
      topupOfOrderId,
      createdAt: new Date(Date.now() - XHUB_RESERVATION_TTL_MS - 1),
    });
    const next = fakeDb.seedOrder();
    await expect(createPendingInvoice(next.id, create)).rejects.toThrow(
      "insufficient_supplier_balance",
    );
  });
}

test("Trybit reservations do not expire with the X-Hub timeout", async () => {
  fakeDb.seedOrder({
    paymentProvider: "trybit",
    paymentInvoiceClaim: "attempted",
    createdAt: new Date(Date.now() - XHUB_RESERVATION_TTL_MS - 1),
  });
  const next = fakeDb.seedOrder();
  await expect(createPendingInvoice(next.id, create)).rejects.toThrow(
    "insufficient_supplier_balance",
  );
});
