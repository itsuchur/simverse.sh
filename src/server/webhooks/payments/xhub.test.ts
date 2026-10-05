import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, test } from "bun:test";

import { handleXhubWebhook } from "~/server/webhooks/payments/xhub";
import { fakeDb } from "~/test/fake-db";
import {
  resetTestState,
  sentryCaptureMessage,
  stubEsimAccess,
} from "~/test/mocks";

const PAYMENT_ID = "pay_550e8400-e29b-41d4-a716-446655440000";
const WEBHOOK_SECRET = "test-xhub-webhook-secret";
const PROFILE = {
  iccid: "89000000000000000004",
  ac: "LPA:1$rsp.example.com$XHUB",
  qrCodeUrl: "https://qr.example/xhub",
  smdpAddress: "rsp.example.com",
  smdpStatus: "RELEASED",
};

function sign(rawBody: string, timestamp: string) {
  return (
    "sha256=" +
    createHmac("sha256", WEBHOOK_SECRET)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex")
  );
}

function callback(
  body: Record<string, unknown>,
  options?: { signature?: string; timestamp?: string },
) {
  const rawBody = JSON.stringify(body);
  const timestamp = options?.timestamp ?? new Date().toISOString();
  const signature = options?.signature ?? sign(rawBody, timestamp);
  return new Request("http://localhost/api/webhooks/payments/xhub", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Id": "5b3fa1e2-9c8d-4f16-8a7b-b2e6f0c9d123",
      "X-Webhook-Timestamp": timestamp,
      "X-Webhook-Signature": signature,
    },
    body: rawBody,
  });
}

function seedPendingOrder(priceAmount = 50000n) {
  fakeDb.seedUser({ id: "user-1", telegramId: "42" });
  return fakeDb.seedOrder({
    paymentProvider: "xhub",
    currency: "RUB",
    priceAmount,
  });
}

function payload(
  orderUuid: string,
  overrides?: Partial<Record<string, unknown>>,
) {
  return {
    event: "payment.status_changed",
    payment_id: PAYMENT_ID,
    external_id: orderUuid,
    status: "paid",
    previous_status: "processing",
    amount_rub: "500.00",
    actual_amount_rub: "500.00",
    amount_usdt: null,
    payment_method: "sbp",
    refund_pending: false,
    timestamp: "2026-04-14T13:05:12Z",
    metadata: null,
    ...overrides,
  };
}

describe("handleXhubWebhook", () => {
  beforeEach(resetTestState);

  test("paid webhook fulfills the order", async () => {
    const order = seedPendingOrder();
    stubEsimAccess({ orderNo: "EA-XHUB", profiles: [PROFILE] });

    const response = await handleXhubWebhook(callback(payload(order.orderUuid)));

    expect(response.status).toBe(200);
    expect(order.paymentStatus).toBe("paid");
    expect(order.paymentChargeId).toBe(PAYMENT_ID);
    expect(order.status).toBe("issued");
    expect(fakeDb.webhookLogs[0]?.source).toBe("xhub");
  });

  test("rejects invalid webhook signatures", async () => {
    const order = seedPendingOrder();

    const response = await handleXhubWebhook(
      callback(payload(order.orderUuid), { signature: "sha256=deadbeef" }),
    );

    expect(response.status).toBe(401);
    expect(order.paymentStatus).toBe("pending");
  });

  test("cancelled webhook fails a pending order", async () => {
    const order = seedPendingOrder();

    const response = await handleXhubWebhook(
      callback(payload(order.orderUuid, { status: "cancelled" })),
    );

    expect(response.status).toBe(200);
    expect(order.paymentStatus).toBe("failed");
    expect(order.status).toBe("failed");
  });

  test("failed webhook fails a pending order", async () => {
    const order = seedPendingOrder();

    const response = await handleXhubWebhook(
      callback(payload(order.orderUuid, { status: "failed" })),
    );

    expect(response.status).toBe(200);
    expect(order.paymentStatus).toBe("failed");
    expect(order.status).toBe("failed");
  });

  test("amount mismatch keeps the order pending and alerts", async () => {
    const order = seedPendingOrder();

    const response = await handleXhubWebhook(
      callback(
        payload(order.orderUuid, {
          amount_rub: "499.00",
          actual_amount_rub: "499.00",
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(order.paymentStatus).toBe("pending");
    expect(sentryCaptureMessage.mock.calls[0]?.[0]).toBe(
      "X-Hub webhook amount mismatch",
    );
  });

  test("processing webhook is a no-op", async () => {
    const order = seedPendingOrder();

    const response = await handleXhubWebhook(
      callback(payload(order.orderUuid, { status: "processing" })),
    );

    expect(response.status).toBe(200);
    expect(order.paymentStatus).toBe("pending");
  });

  test("refunded webhook marks a paid order", async () => {
    const order = fakeDb.seedOrder({
      paymentProvider: "xhub",
      currency: "RUB",
      priceAmount: 50000n,
      paymentStatus: "paid",
      status: "issued",
      paymentChargeId: PAYMENT_ID,
    });

    const response = await handleXhubWebhook(
      callback(
        payload(order.orderUuid, {
          status: "refunded",
          previous_status: "settled",
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(order.paymentStatus).toBe("refunded");
    expect(order.paymentRefundId).toBe(PAYMENT_ID);
    expect(order.refundedAmount).toBe(50000n);
  });

  test("non-payment events are acknowledged", async () => {
    const response = await handleXhubWebhook(
      callback({
        event: "withdrawal.status_changed",
        status: "completed",
      }),
    );

    expect(response.status).toBe(200);
  });
});
