import { beforeEach, describe, expect, test } from "bun:test";

import { handleTrybitWebhook } from "~/server/webhooks/payments/trybit";
import { fakeDb } from "~/test/fake-db";
import {
  clearCart,
  esimOrderCallCount,
  resetTestState,
  sentryCaptureMessage,
  signTrybitToken,
  stubEsimAccess,
} from "~/test/mocks";

function postJson(payload: unknown): Request {
  return new Request("http://localhost/api/webhooks/payments/trybit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

const PROFILE = {
  iccid: "89000000000000000001",
  ac: "LPA:1$rsp.example.com$ABC123",
  qrCodeUrl: "https://qr.example/1",
  smdpAddress: "rsp.example.com",
  esimStatus: "GOT_RESOURCE",
  smdpStatus: "RELEASED",
};

function seedPendingTrybitOrder() {
  fakeDb.seedUser({ id: "user-1", telegramId: "42" });
  return fakeDb.seedOrder({ paymentProvider: "trybit", priceAmount: 1099n });
}

describe("handleTrybitWebhook", () => {
  beforeEach(resetTestState);

  test("paid invoice fulfills the order end to end", async () => {
    const order = seedPendingTrybitOrder();
    stubEsimAccess({ orderNo: "EA-1", profiles: [PROFILE] });

    const response = await handleTrybitWebhook(
      postJson({
        invoice_id: "123",
        order_id: order.orderUuid,
        token: signTrybitToken(),
        invoice_info: { uuid: "INV-uuid-1", status: "paid", amount_usd: 10.99 },
      }),
    );

    expect(response.status).toBe(200);
    expect(order.paymentStatus).toBe("paid");
    expect(order.paymentChargeId).toBe("INV-uuid-1");
    expect(order.status).toBe("issued");
    expect(order.resellerOrderId).toBe("EA-1");
    expect(order.esimIccid).toBe(PROFILE.iccid);
    expect(order.esimActivationCode).toBe(PROFILE.ac);
    expect(order.esimQrUrl).toBe(PROFILE.qrCodeUrl);
    expect(order.esimSmdpStatus).toBe("RELEASED");
    // GOT_RESOURCE is not a lifecycle status, so it must not be persisted.
    expect(order.esimStatus).toBeNull();
    expect(order.paidAt).toBeInstanceOf(Date);
    expect(order.issuedAt).toBeInstanceOf(Date);
    expect(clearCart).toHaveBeenCalledWith("42");
    expect(fakeDb.webhookLogs).toHaveLength(1);
    expect(fakeDb.webhookLogs[0]?.source).toBe("trybit");
  });

  test("invoice_status success with fiat USD amount also fulfills", async () => {
    const order = seedPendingTrybitOrder();
    stubEsimAccess({ profiles: [PROFILE] });

    const response = await handleTrybitWebhook(
      postJson({
        invoice_id: "456",
        order_id: order.orderUuid,
        token: signTrybitToken(),
        invoice_info: {
          invoice_status: "success",
          amount_in_fiat: 10.99,
          fiat_currency: "usd",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(order.paymentStatus).toBe("paid");
    // No uuid in the postback: charge id falls back to INV-<invoice_id>.
    expect(order.paymentChargeId).toBe("INV-456");
  });

  test("paid invoice without a usable amount is ignored", async () => {
    const order = seedPendingTrybitOrder();

    const response = await handleTrybitWebhook(
      postJson({
        invoice_id: "789",
        order_id: order.orderUuid,
        token: signTrybitToken(),
        invoice_info: {
          status: "paid",
          amount_in_fiat: 999,
          fiat_currency: "EUR",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(order.paymentStatus).toBe("pending");
    expect(esimOrderCallCount()).toBe(0);
  });

  test("amount mismatch keeps the order pending and alerts", async () => {
    const order = seedPendingTrybitOrder();

    const response = await handleTrybitWebhook(
      postJson({
        invoice_id: "123",
        order_id: order.orderUuid,
        token: signTrybitToken(),
        invoice_info: { uuid: "INV-1", status: "paid", amount_usd: 5 },
      }),
    );

    expect(response.status).toBe(200);
    expect(order.paymentStatus).toBe("pending");
    expect(order.status).toBe("created");
    expect(sentryCaptureMessage.mock.calls[0]?.[0]).toBe(
      "Trybit webhook amount mismatch",
    );
  });

  test("invalid token returns 401 and does not touch the order", async () => {
    const order = seedPendingTrybitOrder();

    const response = await handleTrybitWebhook(
      postJson({
        invoice_id: "123",
        order_id: order.orderUuid,
        token: signTrybitToken({}, { secret: "wrong-secret" }),
        invoice_info: { uuid: "INV-1", status: "paid", amount_usd: 10.99 },
      }),
    );

    expect(response.status).toBe(401);
    expect(order.paymentStatus).toBe("pending");
  });

  test("canceled invoice fails the pending order", async () => {
    const order = seedPendingTrybitOrder();

    const response = await handleTrybitWebhook(
      postJson({
        invoice_id: "123",
        order_id: order.orderUuid,
        token: signTrybitToken(),
        invoice_info: { status: "canceled" },
      }),
    );

    expect(response.status).toBe(200);
    expect(order.status).toBe("failed");
    expect(order.paymentStatus).toBe("failed");
    expect(order.failureReason).toBe("payment_failed");
  });

  test("payload failing schema validation is acknowledged as a no-op", async () => {
    const response = await handleTrybitWebhook(
      postJson({ invoice_id: "123" }),
    );
    expect(response.status).toBe(200);
  });

  test("non-object JSON body returns 400", async () => {
    expect((await handleTrybitWebhook(postJson("hello"))).status).toBe(400);
    expect((await handleTrybitWebhook(postJson([]))).status).toBe(400);
  });
});
