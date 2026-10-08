import { beforeEach, describe, expect, test } from "bun:test";

import { handlePlategaWebhook } from "~/server/webhooks/payments/platega";
import { fakeDb } from "~/test/fake-db";
import {
  resetTestState,
  sentryCaptureMessage,
  stubEsimAccess,
} from "~/test/mocks";

const TRANSACTION_ID = "00000000-0000-4000-8000-000000000001";
const PROFILE = {
  iccid: "89000000000000000003",
  ac: "LPA:1$rsp.example.com$PLATEGA",
  qrCodeUrl: "https://qr.example/platega",
  smdpAddress: "rsp.example.com",
  smdpStatus: "RELEASED",
};

function callback(
  body: Record<string, unknown>,
  credentials = {
    merchantId: "test-platega-merchant",
    secret: "test-platega-secret",
  },
) {
  return new Request("http://localhost/api/webhooks/payments/platega", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-MerchantId": credentials.merchantId,
      "X-Secret": credentials.secret,
    },
    body: JSON.stringify(body),
  });
}

function seedPendingOrder(currency = "USD", priceAmount = 1099n) {
  fakeDb.seedUser({ id: "user-1", telegramId: "42" });
  return fakeDb.seedOrder({
    paymentProvider: "platega",
    currency,
    priceAmount,
  });
}

function payload(
  orderUuid: string,
  overrides?: Partial<Record<string, unknown>>,
) {
  return {
    id: TRANSACTION_ID,
    amount: 10.99,
    currency: "USD",
    status: "CONFIRMED",
    paymentMethod: 12,
    payload: orderUuid,
    ...overrides,
  };
}

describe("handlePlategaWebhook", () => {
  beforeEach(resetTestState);

  test("CONFIRMED callback fulfills the order", async () => {
    const order = seedPendingOrder();
    stubEsimAccess({ orderNo: "EA-PLATEGA", profiles: [PROFILE] });

    const response = await handlePlategaWebhook(
      callback(payload(order.orderUuid)),
    );

    expect(response.status).toBe(200);
    expect(order.paymentStatus).toBe("paid");
    expect(order.paymentChargeId).toBe(TRANSACTION_ID);
    expect(order.status).toBe("issued");
    expect(fakeDb.webhookLogs[0]?.source).toBe("platega");
    expect(
      (fakeDb.webhookLogs[0]?.headers as Record<string, string>)["x-secret"],
    ).toBe("[REDACTED]");
  });

  test("rejects invalid callback credentials", async () => {
    const order = seedPendingOrder();

    const response = await handlePlategaWebhook(
      callback(payload(order.orderUuid), {
        merchantId: "test-platega-merchant",
        secret: "wrong",
      }),
    );

    expect(response.status).toBe(401);
    expect(order.paymentStatus).toBe("pending");
    expect(fakeDb.webhookLogs).toHaveLength(0);
  });

  test("CANCELED callback fails a pending order", async () => {
    const order = seedPendingOrder();

    const response = await handlePlategaWebhook(
      callback(payload(order.orderUuid, { status: "CANCELED" })),
    );

    expect(response.status).toBe(200);
    expect(order.paymentStatus).toBe("failed");
    expect(order.status).toBe("failed");
  });

  test("amount mismatch keeps the order pending and alerts", async () => {
    const order = seedPendingOrder();

    const response = await handlePlategaWebhook(
      callback(payload(order.orderUuid, { amount: 9.99 })),
    );

    expect(response.status).toBe(200);
    expect(order.paymentStatus).toBe("pending");
    expect(sentryCaptureMessage.mock.calls[0]?.[0]).toBe(
      "Platega webhook amount mismatch",
    );
  });

  test("currency mismatch keeps the order pending and alerts", async () => {
    const order = seedPendingOrder();

    const response = await handlePlategaWebhook(
      callback(payload(order.orderUuid, { currency: "RUB" })),
    );

    expect(response.status).toBe(200);
    expect(order.paymentStatus).toBe("pending");
    expect(sentryCaptureMessage.mock.calls[0]?.[0]).toBe(
      "Platega webhook currency mismatch",
    );
  });

  test("CHARGEBACKED callback marks a paid order", async () => {
    const order = fakeDb.seedOrder({
      paymentProvider: "platega",
      paymentStatus: "paid",
      status: "issued",
      paymentChargeId: TRANSACTION_ID,
    });

    const response = await handlePlategaWebhook(
      callback(payload(order.orderUuid, { status: "CHARGEBACKED" })),
    );

    expect(response.status).toBe(200);
    expect(order.paymentStatus).toBe("chargeback");
    expect(order.paymentChargebackId).toBe(TRANSACTION_ID);
  });

  test("CHARGEBACKED callback does not overwrite a refunded order", async () => {
    const order = fakeDb.seedOrder({
      paymentProvider: "platega",
      paymentStatus: "refunded",
      status: "issued",
      paymentChargeId: TRANSACTION_ID,
      paymentRefundId: TRANSACTION_ID,
      refundedAmount: 1099n,
    });

    const response = await handlePlategaWebhook(
      callback(payload(order.orderUuid, { status: "CHARGEBACKED" })),
    );

    expect(response.status).toBe(200);
    expect(order.paymentStatus).toBe("refunded");
    expect(order.paymentChargebackId).toBeNull();
  });
});
