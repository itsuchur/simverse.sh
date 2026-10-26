import { rejects } from "node:assert/strict";
import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { fakeDb } from "~/test/fake-db";
import { resetTestState } from "~/test/mocks";
import { ensureRefund } from "./store";
import { processUnitpayRefund } from "./unitpay";
import { refundDashboardOrder } from "~/server/dashboard/refund-order";

const originalFetch = globalThis.fetch;
beforeEach(resetTestState);
afterEach(() => {
  globalThis.fetch = originalFetch;
});
function seed() {
  fakeDb.seedUser({ id: "staff-1" });
  return fakeDb.seedOrder({
    paymentProvider: "unitpay",
    paymentChargeId: "987",
    priceAmount: 1099n,
    currency: "USD",
    status: "refund_pending",
    paymentStatus: "paid",
  });
}
function info(account: string, extra = {}) {
  return Response.json({
    result: {
      paymentId: "987",
      projectId: 123456,
      account,
      orderSum: "10.99",
      orderCurrency: "USD",
      status: "success",
      isPreauth: 0,
      availableForRefund: "10.99",
      refunds: [],
      ...extra,
    },
  });
}

test("full refund claims durably before submission and concurrent workers submit once", async () => {
  const order = seed();
  await ensureRefund(order, { source: "automatic", reason: "Issuance failed" });
  let submits = 0;
  globalThis.fetch = mock(async (input: unknown) => {
    const url = new URL(String(input));
    if (url.searchParams.get("method") === "getPayment")
      return info(order.orderUuid);
    submits++;
    expect(fakeDb.refundForOrder(order.id)?.status).toBe("processing");
    expect(url.searchParams.has("sum")).toBe(false);
    return Response.json({ result: { message: "Refund completed" } });
  }) as unknown as typeof fetch;
  await Promise.allSettled([
    processUnitpayRefund(order),
    processUnitpayRefund(order),
  ]);
  expect(submits).toBe(1);
  expect(order.paymentStatus).toBe("refunded");
  expect(fakeDb.refundForOrder(order.id)?.status).toBe("completed");
});

test("unknown refund outcome never resubmits, even when refund status lacks an amount", async () => {
  const order = seed();
  await ensureRefund(order, { source: "automatic", reason: "Issuance failed" });
  let submits = 0;
  let refunded = false;
  globalThis.fetch = mock(async (input: unknown) => {
    if (new URL(String(input)).searchParams.get("method") === "getPayment")
      return info(
        order.orderUuid,
        refunded ? { status: "refund", availableForRefund: "0.00" } : {},
      );
    submits++;
    throw new Error("Connection lost");
  }) as unknown as typeof fetch;
  await rejects(processUnitpayRefund(order), new RegExp("outcome unknown"));
  expect(fakeDb.refundForOrder(order.id)?.status).toBe("manual_review");
  await rejects(
    processUnitpayRefund(order),
    new RegExp("will not be repeated"),
  );
  expect(submits).toBe(1);
  refunded = true;
  await rejects(
    processUnitpayRefund(order),
    new RegExp("will not be repeated"),
  );
  expect(order.paymentStatus).toBe("paid");
  expect(submits).toBe(1);
});

test("wrong payment identity and previous partial refunds cannot trigger a refund", async () => {
  const order = seed();
  await ensureRefund(order, { source: "automatic", reason: "Issuance failed" });
  for (const extra of [
    { account: "other" },
    { orderSum: "1.00" },
    { orderCurrency: "RUB" },
    { availableForRefund: "5.00", refunds: [{}] },
  ]) {
    const http = mock(async () => info(order.orderUuid, extra));
    globalThis.fetch = http as unknown as typeof fetch;
    await rejects(processUnitpayRefund(order));
    expect(http).toHaveBeenCalledTimes(1);
  }
  expect(order.paymentStatus).toBe("paid");
});

test("dashboard backend supports Unitpay without frontend changes", async () => {
  const order = seed();
  order.status = "issued";
  globalThis.fetch = mock(async (input: unknown) =>
    new URL(String(input)).searchParams.get("method") === "getPayment"
      ? info(order.orderUuid)
      : Response.json({ result: { message: "Refund completed" } }),
  ) as unknown as typeof fetch;
  expect(
    await refundDashboardOrder(order.orderUuid, "Customer request", "staff-1"),
  ).toEqual({ pending: false });
  expect(order.status).toBe("refunded");
});
