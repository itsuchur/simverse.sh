import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { reconcilePendingPayments } from "./payment-reconciliation";
import { fakeDb } from "~/test/fake-db";
import { esimAccessPost, esimOrderCallCount, resetTestState, sentryCaptureException, stubEsimAccess } from "~/test/mocks";

const originalFetch = globalThis.fetch;
const http = mock(async (_url: unknown, _init?: RequestInit): Promise<Response> => { throw new Error("Unexpected HTTP request"); });
beforeEach(() => {
  resetTestState();
  http.mockReset();
  globalThis.fetch = http as unknown as typeof fetch;
  fakeDb.seedUser({ id: "user-1", telegramId: "42" });
  stubEsimAccess({ profiles: [{ iccid: "89000000000000000010", ac: "LPA:1$rsp.example.com$TEST", smdpAddress: "rsp.example.com" }] });
});
afterEach(() => { globalThis.fetch = originalFetch; });

function seed(provider = "trybit", extra = {}) {
  return fakeDb.seedOrder({ paymentProvider: provider, currency: provider === "trybit" ? "USD" : "RUB", priceAmount: 500n, paymentInvoiceId: provider === "trybit" ? "INV-test" : "pay-test", ...extra });
}
function trybit(orderUuid: string, extra = {}) {
  return Response.json({ status: "success", result: [{ uuid: "INV-test", order_id: orderUuid, status: "paid", amount_usd: 5, ...extra }] });
}
function xhub(orderUuid: string, extra = {}) {
  return Response.json({ id: "pay-test", external_id: orderUuid, status: "settled", amount_requested: "5.00", amount_received: "5.00", ...extra });
}

test("missed Trybit callback is recovered exactly once, including concurrent workers", async () => {
  const order = seed();
  http.mockImplementation(async () => trybit(order.orderUuid));
  await Promise.all([reconcilePendingPayments(), reconcilePendingPayments()]);
  await reconcilePendingPayments();
  expect(order.status).toBe("issued");
  expect(order.paymentChargeId).toBe("INV-test");
  expect(esimOrderCallCount()).toBe(1);
  expect(http).toHaveBeenCalledTimes(1);
  expect(JSON.parse(http.mock.calls[0]![1]!.body as string)).toEqual({ uuids: ["INV-test"] });
});

test("settled X-Hub payment revives an expired draft", async () => {
  const order = seed("xhub", { status: "failed", paymentStatus: "failed", failureReason: "expired" });
  http.mockImplementation(async () => xhub(order.orderUuid));
  await reconcilePendingPayments();
  expect(order.status).toBe("issued");
  expect(order.failureReason).toBeNull();
});

test("paid top-up is applied to its existing profile, never a new eSIM", async () => {
  const parent = seed("trybit", { paymentStatus: "paid", status: "issued", resellerOrderId: "EA-parent", esimIccid: "8900", esimStatus: "IN_USE", expiresAt: new Date(Date.now() + 86400000) });
  const order = seed("xhub", { topupOfOrderId: parent.id, costAmount: 10000n });
  http.mockImplementation(async () => xhub(order.orderUuid));
  esimAccessPost.mockImplementation(async (path) => {
    if (path === "/esim/query") return { success: true, obj: { esimList: [{ iccid: "8900", esimTranNo: "tran-parent", esimStatus: "IN_USE" }] } };
    if (path === "/esim/topup") return { success: true, obj: { iccid: "8900", totalVolume: 2000000, orderUsage: 1000 } };
    throw new Error("Unexpected supplier purchase");
  });
  await reconcilePendingPayments();
  expect(order.status).toBe("issued");
  expect(esimOrderCallCount()).toBe(0);
  expect(esimAccessPost.mock.calls.find(([path]) => path === "/esim/topup")?.[1]).toMatchObject({ esimTranNo: "tran-parent", transactionId: order.orderUuid });
});

test("unknown invoice creation outcome is discovered by external order reference", async () => {
  const order = seed("xhub", { paymentInvoiceId: null, paymentInvoiceClaim: crypto.randomUUID(), paymentStatus: "failed", status: "failed" });
  http.mockImplementation(async (url) => String(url).includes("?")
    ? Response.json({ data: [{ id: "pay-test", external_id: order.orderUuid }], pagination: { total_pages: 1 } })
    : xhub(order.orderUuid));
  await reconcilePendingPayments();
  expect(order.paymentInvoiceId).toBe("pay-test");
  expect(order.status).toBe("issued");
});

test("duplicate provider invoices are left for manual reconciliation", async () => {
  const trybitOrder = seed("trybit", { paymentInvoiceId: null, paymentInvoiceUrl: "https://pay.trybit.com/dup" });
  http.mockImplementation(async () => Response.json({
    status: "success",
    result: [
      { uuid: "INV-1", order_id: trybitOrder.orderUuid, status: "paid", amount_usd: 5 },
      { uuid: "INV-2", order_id: trybitOrder.orderUuid, status: "paid", amount_usd: 5 },
    ],
    all_count: 2,
  }));
  await reconcilePendingPayments();
  expect(trybitOrder.paymentStatus).toBe("pending");
  expect(trybitOrder.paymentInvoiceId).toBeNull();
  expect(esimOrderCallCount()).toBe(0);
  expect(sentryCaptureException).toHaveBeenCalledTimes(1);

  const xhubOrder = seed("xhub", { paymentInvoiceId: null, paymentInvoiceClaim: crypto.randomUUID() });
  http.mockImplementation(async () => Response.json({
    data: [
      { id: "pay-1", external_id: xhubOrder.orderUuid },
      { id: "pay-2", external_id: xhubOrder.orderUuid },
    ],
    pagination: { total_pages: 1 },
  }));
  await reconcilePendingPayments();
  expect(xhubOrder.paymentStatus).toBe("pending");
  expect(xhubOrder.paymentInvoiceId).toBeNull();
  expect(esimOrderCallCount()).toBe(0);
  expect(sentryCaptureException).toHaveBeenCalledTimes(2);
});

test("pre-migration Trybit invoice is discovered without parsing its checkout URL", async () => {
  const order = seed("trybit", { paymentInvoiceId: null, paymentInvoiceUrl: "https://pay.trybit.com/test" });
  http.mockImplementation(async () => trybit(order.orderUuid));
  await reconcilePendingPayments();
  expect(String(http.mock.calls[0]![0])).toEndWith("/invoice/merchant/list");
  expect(order.paymentInvoiceId).toBe("INV-test");
  expect(order.status).toBe("issued");
});

test("provider outage leaves payment unconfirmed and does not block another order", async () => {
  const bad = seed();
  const good = seed("xhub");
  http.mockImplementation(async (url) => String(url).includes("trybit") ? new Response("", { status: 503 }) : xhub(good.orderUuid));
  await reconcilePendingPayments();
  expect(bad.paymentStatus).toBe("pending");
  expect(bad.paymentNextCheckAt.getTime()).toBeGreaterThan(Date.now());
  expect(good.status).toBe("issued");
  expect(sentryCaptureException).toHaveBeenCalledTimes(1);
});

test("invoice belonging to a different order cannot fulfill", async () => {
  const order = seed();
  http.mockImplementation(async () => trybit(crypto.randomUUID()));
  await reconcilePendingPayments();
  expect(order.paymentStatus).toBe("pending");
  expect(esimOrderCallCount()).toBe(0);
  expect(sentryCaptureException).toHaveBeenCalledTimes(1);
});

test("wrong amount and partial payment never buy a supplier package", async () => {
  const order = seed();
  http.mockImplementation(async () => trybit(order.orderUuid, { amount_usd: 4 }));
  await reconcilePendingPayments();
  expect(order.paymentStatus).toBe("pending");
  order.paymentNextCheckAt = new Date(0);
  http.mockImplementation(async () => trybit(order.orderUuid, { status: "partial" }));
  await reconcilePendingPayments();
  expect(order.paymentStatus).toBe("pending");
  expect(esimOrderCallCount()).toBe(0);
});

test("old invoices remain eligible, while refunded orders and untouched drafts are skipped", async () => {
  const old = seed("trybit", { createdAt: new Date("2026-01-01"), paymentStatus: "failed", status: "failed" });
  seed("xhub", { paymentStatus: "refunded", status: "refunded" });
  seed("trybit", { paymentInvoiceId: null });
  http.mockImplementation(async () => trybit(old.orderUuid, { status: "created" }));
  await reconcilePendingPayments();
  expect(http).toHaveBeenCalledTimes(1);
  expect(old.paymentNextCheckAt.getTime() - Date.now()).toBeGreaterThan(23 * 3600000);
});
