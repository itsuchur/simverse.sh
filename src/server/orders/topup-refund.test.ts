import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { createHmac } from "node:crypto";
import {
  fulfillTrybitPayment,
  fulfillXhubPayment,
  placeSupplierOrder,
  recoverPendingOrders,
} from "~/server/orders/fulfill";
import {
  processPendingRefund,
  syncXhubRefund,
} from "~/server/orders/topup-refund";
import { handleXhubWebhook } from "~/server/webhooks/payments/xhub";
import { fakeDb } from "~/test/fake-db";
import {
  resetTestState,
  esimAccessPost,
  sentryCaptureException,
  telegramSendMessage,
} from "~/test/mocks";
import { EsimAccessApiError } from "~/server/suppliers/esimaccess/error";

const PAYMENT = "pay_550e8400-e29b-41d4-a716-446655440000";
const REFUND = "ref_9f8e7d6c-5b4a-4321-9876-0123456789ab";
const originalFetch = globalThis.fetch;

beforeEach(resetTestState);
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function seedTopup(provider = "xhub") {
  fakeDb.seedUser({ id: "user-1", telegramId: "42" });
  const parent = fakeDb.seedOrder({
    status: "issued",
    paymentStatus: "paid",
    esimIccid: "89000000000000000010",
    esimActivationCode: "LPA:1$rsp.example.com$K",
    esimSmdpAddress: "rsp.example.com",
    esimStatus: "IN_USE",
    expiresAt: new Date(Date.now() - 1000),
  });
  const child = fakeDb.seedOrder({
    paymentProvider: provider,
    currency: provider === "xhub" ? "RUB" : "USD",
    priceAmount: 50000n,
    topupOfOrderId: parent.id,
    resellerPlanId: "TOPUP_CKH491",
    costAmount: 70000n,
  });
  return { parent, child };
}

function refund(status = "requested", overrides: Record<string, unknown> = {}) {
  return {
    id: REFUND,
    payment_id: PAYMENT,
    amount_rub: "500.00",
    status,
    ...overrides,
  };
}

function stubRefund(
  status = "requested",
  overrides: Record<string, unknown> = {},
) {
  const fetchMock = mock(
    async (_url: Parameters<typeof fetch>[0], _init?: RequestInit) =>
      Response.json(refund(status, overrides)),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function payXhub(orderUuid: string) {
  return fulfillXhubPayment({
    orderUuid,
    paymentId: PAYMENT,
    amountRub: "500.00",
  });
}

function webhook(event: string) {
  const body = JSON.stringify({
    event,
    payment_id: PAYMENT.slice(4),
    refund_id: REFUND.slice(4),
  });
  const timestamp = new Date().toISOString();
  const signature =
    "sha256=" +
    createHmac("sha256", "test-xhub-webhook-secret")
      .update(`${timestamp}.${body}`)
      .digest("hex");
  return new Request("http://localhost/api/webhooks/payments/xhub", {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/json",
      "x-webhook-signature": signature,
      "x-webhook-timestamp": timestamp,
    },
  });
}

describe("unfulfillable paid top-ups", () => {
  test("late X-Hub payment creates one full refund and waits for confirmation", async () => {
    const { child } = seedTopup();
    const fetchMock = stubRefund();
    await payXhub(child.orderUuid);
    expect(child.paymentStatus).toBe("paid");
    expect(child.status).toBe("refund_pending");
    expect(fakeDb.refundForOrder(child.id)?.providerRefundId ?? null).toBe(
      REFUND,
    );
    expect(child.refundedAmount).toBeNull();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.x-hub.online/api/v1/refunds");
    expect(init?.headers).toMatchObject({
      "Idempotency-Key": fakeDb.refundForOrder(child.id)!.idempotencyKey,
      "X-Api-Key": "xh_test_key",
    });
    expect(fakeDb.refundForOrder(child.id)!.idempotencyKey).not.toBe(
      child.orderUuid,
    );
    expect(JSON.parse(init?.body as string)).toEqual({
      payment_id: PAYMENT,
      external_id: child.orderUuid,
      reason:
        "Top-up cannot be fulfilled because the parent eSIM is unavailable.",
    });
    await payXhub(child.orderUuid);
    await recoverPendingOrders();
    expect(
      fetchMock.mock.calls.filter(([, options]) => options?.method === "POST"),
    ).toHaveLength(1);
    expect(esimAccessPost).not.toHaveBeenCalled();
  });

  test("refund completion without external_id closes the order; stale events use current REST state", async () => {
    const { child } = seedTopup();
    stubRefund();
    await payXhub(child.orderUuid);
    stubRefund("completed");
    expect((await handleXhubWebhook(webhook("refund.completed"))).status).toBe(
      200,
    );
    expect(child.paymentStatus).toBe("refunded");
    expect(child.status).toBe("refunded");
    expect(child.refundedAmount).toBe(50000n);
    await handleXhubWebhook(webhook("refund.failed"));
    expect(child.paymentStatus).toBe("refunded");
    expect(child.status).toBe("refunded");
  });

  test("the recovery worker polls an asynchronous refund to completion", async () => {
    const { child } = seedTopup();
    stubRefund();
    await payXhub(child.orderUuid);
    const fetchMock = stubRefund("completed");
    await recoverPendingOrders();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `https://api.x-hub.online/api/v1/refunds/${REFUND}`,
    );
    expect(child.paymentStatus).toBe("refunded");
  });

  for (const httpStatus of [400, 401, 404, 500]) {
    test(`HTTP ${httpStatus} logs an actionable Sentry error and stops supplier retries`, async () => {
      const { child } = seedTopup();
      const fetchMock = mock(async () =>
        Response.json({ error: "unavailable" }, { status: httpStatus }),
      );
      globalThis.fetch = fetchMock as unknown as typeof fetch;
      await payXhub(child.orderUuid);
      expect(child.status).toBe("refund_required");
      expect(child.paymentStatus).toBe("paid");
      expect(sentryCaptureException.mock.calls[0]?.[1]).toMatchObject({
        tags: { payment_provider: "xhub", reason: "topup_refund_failed" },
        extra: {
          orderUuid: child.orderUuid,
          paymentChargeId: PAYMENT,
          amount: "50000",
          currency: "RUB",
          manualRefundRequired: true,
        },
      });
      await recoverPendingOrders();
      await payXhub(child.orderUuid);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(esimAccessPost).not.toHaveBeenCalled();
    });
  }

  test("Trybit cannot refund without payout details: Sentry and a durable manual state", async () => {
    const { child } = seedTopup("trybit");
    const fetchMock = stubRefund();
    await fulfillTrybitPayment({
      orderUuid: child.orderUuid,
      invoiceUuid: "INV-LATE",
      amountUsd: 500,
    });
    expect(child.status).toBe("refund_required");
    expect(child.paymentStatus).toBe("paid");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sentryCaptureException.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect(
      (sentryCaptureException.mock.calls[0]?.[0] as Error).message,
    ).toContain("Trybit automatic refund unavailable");
    await recoverPendingOrders();
    expect(esimAccessPost).not.toHaveBeenCalled();
    expect(sentryCaptureException).toHaveBeenCalledTimes(1);
  });

  for (const outcome of ["rejected", "failed", "cancelled", "reversed"]) {
    test(`refund ${outcome} needs manual resolution and logs Sentry`, async () => {
      const { child } = seedTopup();
      stubRefund();
      await payXhub(child.orderUuid);
      if (outcome === "reversed") {
        stubRefund("completed");
        await processPendingRefund(child.id);
      }
      stubRefund(outcome);
      await syncXhubRefund({
        paymentId: PAYMENT.slice(4),
        refundId: REFUND.slice(4),
      });
      expect(child.status).toBe("refund_required");
      expect(child.paymentStatus).toBe("paid");
      expect(child.refundedAmount).toBeNull();
      expect(sentryCaptureException).toHaveBeenCalledTimes(1);
    });
  }

  test("timeout reports uncertainty and late confirmation can still resolve it", async () => {
    const { child } = seedTopup();
    globalThis.fetch = mock(async () => {
      throw new Error("timeout");
    }) as unknown as typeof fetch;
    await payXhub(child.orderUuid);
    expect(child.status).toBe("refund_required");
    const refundKey = fakeDb.refundForOrder(child.id)!.idempotencyKey;
    stubRefund("completed");
    await handleXhubWebhook(webhook("refund.completed"));
    expect(child.status).toBe("refunded");
    expect(fakeDb.refundForOrder(child.id)!.idempotencyKey).toBe(refundKey);
  });

  test("a previously abandoned supplier request must be reconciled before refunding", async () => {
    const { child } = seedTopup();
    child.status = "failed";
    child.paymentStatus = "paid";
    child.paymentChargeId = PAYMENT;
    child.updatedAt = new Date(0);
    const fetchMock = stubRefund();
    await recoverPendingOrders();
    expect(child.status).toBe("refund_required");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      (sentryCaptureException.mock.calls[0]?.[0] as Error).message,
    ).toContain("previous supplier top-up may have succeeded");
  });

  test("fresh supplier expiry takes priority over an expired local snapshot", async () => {
    const { parent, child } = seedTopup();
    parent.resellerOrderId = "EA-PARENT";
    child.status = "paid";
    child.paymentStatus = "paid";
    const future = new Date(Date.now() + 7 * 86400000).toISOString();
    esimAccessPost.mockImplementation(async (path: string) =>
      path === "/esim/query"
        ? {
            success: true,
            obj: {
              esimList: [
                {
                  iccid: parent.esimIccid,
                  esimTranNo: "EA-TRAN",
                  esimStatus: "IN_USE",
                  expiredTime: future,
                },
              ],
            },
          }
        : {
            success: true,
            obj: { iccid: parent.esimIccid, expiredTime: future },
          },
    );
    const fetchMock = stubRefund();
    await placeSupplierOrder(child);
    expect(child.status).toBe("issued");
    expect(parent.expiresAt?.toISOString()).toBe(future);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("supplier expiry rejection after a valid snapshot triggers a refund", async () => {
    const { parent, child } = seedTopup();
    parent.expiresAt = new Date(Date.now() + 1000);
    esimAccessPost.mockRejectedValueOnce(
      new EsimAccessApiError("200002", "profile expired"),
    );
    stubRefund();
    await payXhub(child.orderUuid);
    expect(child.status).toBe("refund_pending");
  });

  test("refund amount mismatch is never reported as money returned", async () => {
    const { child } = seedTopup();
    stubRefund("completed", { amount_rub: "1.00" });
    await payXhub(child.orderUuid);
    expect(child.status).toBe("refund_required");
    expect(child.paymentStatus).toBe("paid");
    expect(child.refundedAmount).toBeNull();
    expect(sentryCaptureException).toHaveBeenCalledTimes(1);
  });

  test("concurrent refund workers reuse a persisted key, including after a restart", async () => {
    const { child } = seedTopup();
    child.status = "refund_pending";
    child.paymentStatus = "paid";
    child.paymentChargeId = PAYMENT;
    const key = fakeDb.seedRefund({ orderId: child.id }).idempotencyKey;
    const fetchMock = stubRefund();
    await Promise.all([
      processPendingRefund(child.id),
      processPendingRefund(child.id),
    ]);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.headers).toMatchObject({ "Idempotency-Key": key });
    }
    // Simulate a crash after the provider accepted the request but before its
    // ID was stored. Recovery must send exactly the same logical request.
    fakeDb.refundForOrder(child.id)!.providerRefundId = null;
    await processPendingRefund(child.id);
    expect(fetchMock.mock.calls.at(-1)?.[1]?.headers).toMatchObject({
      "Idempotency-Key": key,
    });
  });

  test("a webhook for another payment or refund cannot close this order", async () => {
    const { child } = seedTopup();
    stubRefund();
    await payXhub(child.orderUuid);
    const fetchMock = stubRefund("completed");
    await syncXhubRefund({ paymentId: "other-payment", refundId: REFUND });
    await syncXhubRefund({ paymentId: PAYMENT, refundId: "other-refund" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(child.status).toBe("refund_pending");
  });

  test("refund completion notifies the buyer once about the failed top-up", async () => {
    const { child } = seedTopup();
    stubRefund();
    await payXhub(child.orderUuid);
    stubRefund("completed");
    await handleXhubWebhook(webhook("refund.completed"));
    expect(telegramSendMessage).toHaveBeenCalledTimes(1);
    expect(telegramSendMessage.mock.calls[0]?.[0]).toMatchObject({
      chatId: 42,
      text: expect.stringContaining("top-up") as unknown,
    });
    await handleXhubWebhook(webhook("refund.completed"));
    expect(telegramSendMessage).toHaveBeenCalledTimes(1);
  });
});

describe("unfulfillable paid eSIM purchases", () => {
  function seedPurchase() {
    fakeDb.seedUser({ id: "user-1", telegramId: "42", languageCode: "en" });
    return fakeDb.seedOrder({
      paymentProvider: "xhub",
      currency: "RUB",
      priceAmount: 50000n,
      costAmount: 70000n,
      resellerPlanId: "CKH491",
    });
  }

  test("confirmed insufficient balance auto-refunds and notifies the buyer once", async () => {
    const order = seedPurchase();
    esimAccessPost.mockImplementation(async (path: string) => {
      if (path === "/esim/order") {
        throw new EsimAccessApiError("200007", "Balance insufficient");
      }
      if (path === "/balance/query") {
        return { success: true, obj: { balance: 100 } };
      }
      throw new Error(`unexpected path ${path}`);
    });
    const fetchMock = stubRefund();
    await payXhub(order.orderUuid);
    expect(order.status).toBe("refund_pending");
    expect(order.failureReason).toBe("supplier_balance_insufficient");
    expect(fakeDb.refundForOrder(order.id)?.reason).toContain(
      "insufficient merchant balance",
    );
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.x-hub.online/api/v1/refunds");
    expect(JSON.parse(init?.body as string)).toMatchObject({
      payment_id: PAYMENT,
      external_id: order.orderUuid,
      reason: expect.stringContaining("insufficient merchant balance") as unknown,
    });

    stubRefund("completed");
    await handleXhubWebhook(webhook("refund.completed"));
    expect(order.status).toBe("refunded");
    expect(telegramSendMessage).toHaveBeenCalledTimes(1);
    expect(telegramSendMessage.mock.calls[0]?.[0]).toMatchObject({
      chatId: 42,
      text: expect.stringContaining("eSIM") as unknown,
    });
    await handleXhubWebhook(webhook("refund.completed"));
    expect(telegramSendMessage).toHaveBeenCalledTimes(1);
  });

  test("insufficient balance with recovered funds does not refund or fail", async () => {
    const order = seedPurchase();
    esimAccessPost.mockImplementation(async (path: string) => {
      if (path === "/esim/order") {
        throw new EsimAccessApiError("200007", "Balance insufficient");
      }
      if (path === "/balance/query") {
        return { success: true, obj: { balance: 900_000 } };
      }
      throw new Error(`unexpected path ${path}`);
    });
    const fetchMock = stubRefund();
    await payXhub(order.orderUuid);
    expect(order.status).toBe("ordering");
    expect(order.failureReason).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fakeDb.refundForOrder(order.id)).toBeNull();
  });

  test("non-balance supplier errors still fail without refund", async () => {
    const order = seedPurchase();
    esimAccessPost.mockRejectedValueOnce(
      new EsimAccessApiError("400001", "Invalid parameters"),
    );
    const fetchMock = stubRefund();
    await payXhub(order.orderUuid);
    expect(order.status).toBe("failed");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fakeDb.refundForOrder(order.id)).toBeNull();
  });
});
