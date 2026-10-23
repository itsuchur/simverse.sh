import { markXhubRefunded } from "~/server/orders/fulfill";
import { rejects } from "node:assert/strict";
import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { refundDashboardOrder as submitRefund } from "./refund-order";
import {
  processPendingRefund,
  syncXhubRefund,
} from "~/server/orders/topup-refund";
import { fakeDb } from "~/test/fake-db";
import { esimAccessPost, resetTestState } from "~/test/mocks";

const originalFetch = globalThis.fetch;
const paymentId = "pay_550e8400-e29b-41d4-a716-446655440000";
const refundId = "ref_9f8e7d6c-5b4a-4321-9876-0123456789ab";
const refundDashboardOrder = (id: string, reason: string) =>
  submitRefund(id, reason, "staff-1");
beforeEach(() => {
  resetTestState();
  fakeDb.seedUser({ id: "staff-1", email: "support@simverse.sh" });
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});
function seed() {
  return fakeDb.seedOrder({
    paymentProvider: "xhub",
    paymentStatus: "paid",
    status: "issued",
    paymentChargeId: paymentId,
    priceAmount: 50000n,
    currency: "RUB",
  });
}
function stub(status = "requested", overrides = {}) {
  const fetchMock = mock(
    async (_url: Parameters<typeof fetch>[0], _init?: RequestInit) =>
      Response.json({
        id: refundId,
        payment_id: paymentId,
        amount_rub: "500.00",
        status,
        ...overrides,
      }),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}
test("missing, blank, or oversized refund reasons cause no side effects", async () => {
  const order = seed();
  const fetchMock = stub();
  for (const reason of [undefined, "", "   ", "x".repeat(501)]) {
    await rejects(refundDashboardOrder(order.orderUuid, reason!));
  }
  expect(fetchMock).not.toHaveBeenCalled();
  expect(esimAccessPost).not.toHaveBeenCalled();
  expect(order.status).toBe("issued");
  expect(fakeDb.refundForOrder(order.id)?.reason ?? null).toBeNull();
});
test("submitted reason is stored and sent with a durable refund key; requested is not completed", async () => {
  const order = seed();
  const fetchMock = stub();
  expect(
    await refundDashboardOrder(order.orderUuid, "  Customer request  "),
  ).toEqual({ pending: true });
  expect(fakeDb.refundForOrder(order.id)?.reason ?? null).toBe(
    "Customer request",
  );
  expect(order.status).toBe("refund_pending");
  expect(fakeDb.refundForOrder(order.id)).toMatchObject({
    source: "dashboard",
    requestedById: "staff-1",
    status: "processing",
  });
  expect(order.paymentStatus).toBe("paid");
  expect(fakeDb.refundForOrder(order.id)?.providerRefundId ?? null).toBe(
    refundId,
  );
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe("https://api.x-hub.online/api/v1/refunds");
  expect(new Headers(init?.headers).get("Idempotency-Key")).toBe(
    fakeDb.refundForOrder(order.id)!.idempotencyKey,
  );
  expect(JSON.parse(init?.body as string)).toEqual({
    payment_id: paymentId,
    external_id: order.orderUuid,
    reason: "Customer request",
  });
});
test("normal-order webhook reconciliation confirms completion and reversal", async () => {
  const order = seed();
  stub();
  await refundDashboardOrder(order.orderUuid, "Customer request");
  stub("completed");
  await syncXhubRefund({ paymentId, refundId });
  expect(order.paymentStatus).toBe("refunded");
  expect(order.refundedAmount).toBe(50000n);
  stub("reversed");
  await syncXhubRefund({ paymentId, refundId });
  expect(order.paymentStatus).toBe("paid");
  expect(order.status).toBe("refund_required");
});
test("timeout recovery reuses the persisted reason and key", async () => {
  const order = seed();
  globalThis.fetch = mock(async () => {
    throw new Error("timeout");
  }) as unknown as typeof fetch;
  await rejects(
    refundDashboardOrder(order.orderUuid, "Customer request"),
    new RegExp("timeout"),
  );
  expect(order.status).toBe("refund_pending");
  const fetchMock = stub("completed");
  await processPendingRefund(order.id);
  expect(order.paymentStatus).toBe("refunded");
  const init = fetchMock.mock.calls[0]![1];
  expect(new Headers(init?.headers).get("Idempotency-Key")).toBe(
    fakeDb.refundForOrder(order.id)!.idempotencyKey,
  );
  expect((JSON.parse(init?.body as string) as { reason: string }).reason).toBe(
    "Customer request",
  );
});
test("activated profiles cannot be refunded or cancelled", async () => {
  const order = seed();
  order.resellerOrderId = "supplier-order";
  const fetchMock = stub();
  esimAccessPost.mockImplementation(async () => ({
    success: true,
    obj: {
      esimList: [
        {
          iccid: "89000000000000000001",
          esimStatus: "IN_USE",
          esimTranNo: "tran-1",
        },
      ],
    },
  }));
  await rejects(
    refundDashboardOrder(order.orderUuid, "Customer request"),
    new RegExp("activated"),
  );
  expect(fetchMock).not.toHaveBeenCalled();
  expect(order.status).toBe("issued");
});
test("unused profile is cancelled before requesting the refund", async () => {
  const order = seed();
  order.resellerOrderId = "supplier-order";
  const fetchMock = stub("completed");
  esimAccessPost.mockImplementation(async (path) => {
    expect(fetchMock).not.toHaveBeenCalled();
    return {
      success: true,
      obj:
        path === "/esim/query"
          ? {
              esimList: [
                {
                  iccid: "89000000000000000001",
                  esimStatus: "NOT_ACTIVE",
                  smdpStatus: "RELEASED",
                  esimTranNo: "tran-1",
                },
              ],
            }
          : {},
    };
  });
  await refundDashboardOrder(order.orderUuid, "Customer request");
  expect(
    esimAccessPost.mock.calls.some(([path]) => path === "/esim/cancel"),
  ).toBe(true);
  expect(order.esimStatus).toBe("CANCEL");
  expect(order.paymentStatus).toBe("refunded");
});
test("rejects unsafe top-ups, fulfillment in progress, unsupported providers and changed retry reasons", async () => {
  const order = seed();
  const fetchMock = stub();
  order.topupOfOrderId = 100n;
  await rejects(
    refundDashboardOrder(order.orderUuid, "Customer request"),
    new RegExp("Top-up"),
  );
  order.topupOfOrderId = null;
  order.status = "ordering";
  await rejects(
    refundDashboardOrder(order.orderUuid, "Customer request"),
    new RegExp("in progress"),
  );
  order.status = "issued";
  order.paymentProvider = "trybit";
  await rejects(
    refundDashboardOrder(order.orderUuid, "Customer request"),
    new RegExp("provider"),
  );
  order.paymentProvider = "xhub";
  fakeDb.seedRefund({ orderId: order.id, reason: "Original request" });
  await rejects(
    refundDashboardOrder(order.orderUuid, "Different request"),
    new RegExp("different reason"),
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

test("payment-level refund events cannot overwrite a managed refund ID", async () => {
  const order = seed();
  stub();
  await refundDashboardOrder(order.orderUuid, "Customer request");
  await markXhubRefunded({
    orderUuid: order.orderUuid,
    paymentId,
    refundedAmount: 50000n,
  });
  expect(fakeDb.refundForOrder(order.id)?.providerRefundId ?? null).toBe(
    refundId,
  );
  expect(order.paymentStatus).toBe("paid");
  stub("completed");
  await syncXhubRefund({ paymentId, refundId });
  expect(order.paymentStatus).toBe("refunded");
});
