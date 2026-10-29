import { afterAll, beforeEach, expect, spyOn, test } from "bun:test";
import { OrdersController, type Order } from "@paypal/paypal-server-sdk";
import * as paypal from "~/server/payments/paypal";
import { handlePaypalWebhook } from "./paypal";
import { fakeDb } from "~/test/fake-db";
import {
  resetTestState,
  stubEsimAccess,
  esimOrderCallCount,
} from "~/test/mocks";
import { redactWebhookHeaders } from "~/lib/webhook-redaction";

const verify = spyOn(paypal, "verifyPaypalWebhook");
const getOrder = spyOn(OrdersController.prototype, "getOrder");
const capture = spyOn(OrdersController.prototype, "captureOrder");
afterAll(() => {
  verify.mockRestore();
  getOrder.mockRestore();
  capture.mockRestore();
});
beforeEach(() => {
  resetTestState();
  verify.mockReset();
  getOrder.mockReset();
  capture.mockReset();
  verify.mockResolvedValue(true);
  fakeDb.seedUser({ id: "user-1", telegramId: "42" });
});
function request(type = "PAYMENT.CAPTURE.COMPLETED") {
  return new Request("http://localhost/api/webhooks/payments/paypal", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "paypal-transmission-sig": "signature",
    },
    body: JSON.stringify({
      id: "EVENT1",
      event_type: type,
      resource: {
        id: "CAPTURE123",
        supplementary_data: { related_ids: { order_id: "PAYPAL123" } },
      },
    }),
  });
}

test("unverified events never log or fulfill", async () => {
  verify.mockResolvedValue(false);
  expect((await handlePaypalWebhook(request())).status).toBe(401);
  expect(getOrder).not.toHaveBeenCalled();
  expect(fakeDb.webhookLogs).toHaveLength(0);
});

test("verification outages request a retry without acknowledging payment", async () => {
  verify.mockRejectedValue(new Error("PayPal unavailable"));
  expect((await handlePaypalWebhook(request())).status).toBe(503);
  expect(getOrder).not.toHaveBeenCalled();
});

test("duplicate signed completion events verify the merchant record and fulfill once", async () => {
  const order = fakeDb.seedOrder({
    paymentProvider: "paypal",
    paymentInvoiceId: "PAYPAL123",
    priceAmount: 1099n,
    currency: "USD",
  });
  stubEsimAccess({ orderNo: "EA-PAYPAL", profiles: [] });
  const result = {
    id: "PAYPAL123",
    status: "COMPLETED",
    purchaseUnits: [
      {
        customId: order.orderUuid,
        amount: { currencyCode: "USD", value: "10.99" },
        payments: {
          captures: [
            {
              id: "CAPTURE123",
              status: "COMPLETED",
              amount: { currencyCode: "USD", value: "10.99" },
            },
          ],
        },
      },
    ],
  };
  getOrder.mockResolvedValue({
    result: result as Order,
    statusCode: 200,
    headers: {},
  } as Awaited<ReturnType<OrdersController["getOrder"]>>);
  expect((await handlePaypalWebhook(request())).status).toBe(200);
  expect((await handlePaypalWebhook(request())).status).toBe(200);
  expect(order.paymentChargeId).toBe("CAPTURE123");
  expect(esimOrderCallCount()).toBe(1);
  expect(capture).not.toHaveBeenCalled();
  expect(fakeDb.webhookLogs).toHaveLength(2);
});

test("PayPal transmission signatures are redacted from audit headers", () => {
  expect(
    redactWebhookHeaders(new Headers({ "paypal-transmission-sig": "private" }))[
      "paypal-transmission-sig"
    ],
  ).toBe("[REDACTED]");
});
