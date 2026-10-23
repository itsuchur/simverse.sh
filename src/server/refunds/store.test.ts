import { beforeEach, expect, test } from "bun:test";
import { fakeDb } from "~/test/fake-db";
import { resetTestState } from "~/test/mocks";
import { ensureRefund, recordCompletedRefund } from "./store";
import { applyXhubRefund } from "~/server/orders/topup-refund";

beforeEach(resetTestState);

test("repeated requests reuse the refund identity, reason, initiator and idempotency key", async () => {
  const order = fakeDb.seedOrder({
    paymentStatus: "paid",
    paymentChargeId: "bill-1",
  });
  const first = await ensureRefund(order, {
    reason: "Original reason",
    source: "dashboard",
    requestedById: "staff-1",
  });
  const second = await ensureRefund(order, {
    reason: "Ignored duplicate",
    source: "automatic",
  });
  expect(second).toMatchObject({
    id: first.id,
    idempotencyKey: first.idempotencyKey,
    reason: "Original reason",
    source: "dashboard",
    requestedById: "staff-1",
  });
});

test("concurrent provider callbacks record one refund and update the order summary", async () => {
  const order = fakeDb.seedOrder({
    paymentProvider: "platega",
    paymentStatus: "paid",
    paymentChargeId: "tx-1",
  });
  const event = {
    orderUuid: order.orderUuid,
    provider: "platega",
    paymentId: "tx-1",
    refundId: "ref-1",
    amount: 1099n,
  };
  await Promise.all([
    recordCompletedRefund(event),
    recordCompletedRefund(event),
  ]);
  const refund = fakeDb.refundForOrder(order.id);
  expect(refund).toMatchObject({
    status: "completed",
    source: "provider",
    amount: 1099n,
    providerRefundId: "ref-1",
  });
  expect(refund?.completedAt).toBeInstanceOf(Date);
  expect(order.paymentStatus).toBe("refunded");
  expect(order.refundedAmount).toBe(1099n);
  await recordCompletedRefund({ ...event, refundId: "ref-2" });
  expect(fakeDb.refundForOrder(order.id)?.providerRefundId).toBe("ref-1");
});

test("mismatched payments, amounts and currencies cannot create a refund", async () => {
  const order = fakeDb.seedOrder({
    paymentProvider: "cardlink",
    paymentStatus: "paid",
    paymentChargeId: "bill-1",
  });
  const event = {
    orderUuid: order.orderUuid,
    provider: "cardlink",
    paymentId: "bill-1",
    refundId: "ref-1",
    amount: 1099n,
    currency: "USD",
  };
  for (const mutation of [
    { paymentId: "another-bill" },
    { currency: "RUB" },
    { amount: 0n },
    { amount: 99999n },
  ]) {
    await recordCompletedRefund({ ...event, ...mutation });
  }
  expect(fakeDb.refundForOrder(order.id)).toBeNull();
  expect(order.paymentStatus).toBe("paid");
});

test("completed and reversed refunds resist stale asynchronous states", async () => {
  const order = fakeDb.seedOrder({
    paymentProvider: "xhub",
    paymentStatus: "paid",
    paymentChargeId: "pay-1",
    status: "refund_pending",
    priceAmount: 50000n,
    currency: "RUB",
  });
  await ensureRefund(order, { source: "automatic", reason: "Expired top-up" });
  const response = {
    id: "ref-1",
    payment_id: "pay-1",
    amount_rub: "500.00",
    status: "completed" as const,
  };
  await applyXhubRefund(order, response);
  await applyXhubRefund(order, { ...response, status: "requested" });
  await applyXhubRefund(order, { ...response, status: "failed" });
  expect(fakeDb.refundForOrder(order.id)?.status).toBe("completed");
  expect(order.paymentStatus).toBe("refunded");
  const completedAt = fakeDb.refundForOrder(order.id)?.completedAt;
  await applyXhubRefund(order, { ...response, status: "reversed" });
  await applyXhubRefund(order, response);
  expect(fakeDb.refundForOrder(order.id)).toMatchObject({
    status: "reversed",
    completedAt,
  });
  expect(order.paymentStatus).toBe("paid");
  expect(order.refundedAmount).toBeNull();
});

test("failed reconciliation updates neither the order total nor completion state", async () => {
  const order = fakeDb.seedOrder({
    paymentProvider: "xhub",
    paymentStatus: "paid",
    paymentChargeId: "pay-1",
    status: "refund_pending",
    priceAmount: 50000n,
    currency: "RUB",
  });
  await ensureRefund(order, { source: "automatic", reason: "Expired top-up" });
  const error = await applyXhubRefund(order, {
    id: "ref-1",
    payment_id: "other-payment",
    amount_rub: "500.00",
    status: "completed",
  }).catch((error: unknown) => error);
  expect(error).toBeInstanceOf(Error);
  expect(fakeDb.refundForOrder(order.id)?.status).toBe("requested");
  expect(order.refundedAmount).toBeNull();
});
