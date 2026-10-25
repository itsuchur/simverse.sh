/** Payment audit reproductions assert current vulnerable behavior; control and
 * logging tests assert the intended protections.
 * All credentials, database writes, and supplier requests use test fixtures.
 */
import { beforeEach, expect, spyOn, test } from "bun:test";
import { createHash } from "node:crypto";
import { handleTrybitWebhook } from "~/server/webhooks/payments/trybit";
import {
  handleCardlinkWebhook,
  handleCardlinkRefundWebhook,
} from "~/server/webhooks/payments/cardlink";
import { fakeDb } from "~/test/fake-db";
import { withWebhookLogging } from "~/lib/webhook-logger";
import { prepareTopupPurchase } from "~/server/orders/topup";
import { checkEsimUsage } from "~/server/orders/usage-check";
import {
  resetTestState,
  signTrybitToken,
  stubEsimAccess,
  esimOrderCallCount,
} from "~/test/mocks";

beforeEach(() => {
  resetTestState();
  fakeDb.seedUser({ id: "user-1", telegramId: "42" });
  stubEsimAccess();
});

function post(body: unknown) {
  return new Request("http://localhost/api/webhooks/payments/audit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function cardlinkSign(body: string) {
  return createHash("md5")
    .update(`${body}:test-cardlink-token`)
    .digest("hex")
    .toUpperCase();
}

test("Trybit rejects altered outer payment fields even with an authentic JWT", async () => {
  const first = fakeDb.seedOrder({
    paymentProvider: "trybit",
    priceAmount: 1099n,
  });
  const second = fakeDb.seedOrder({
    paymentProvider: "trybit",
    priceAmount: 9999n,
  });
  // Model possession of a legitimate token for an unrelated unpaid invoice.
  // The attacker never changes or re-signs this token between requests.
  const token = signTrybitToken({
    order_id: "unrelated-order",
    invoice_id: "original",
    status: "canceled",
  });
  const lookup = spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ status: "success", result: [] }),
  );
  try {
    for (const [index, order] of [first, second].entries()) {
      const response = await handleTrybitWebhook(
        post({
          token,
          order_id: order.orderUuid,
          invoice_id: `invented-${index}`,
          invoice_info: {
            status: "paid",
            amount_usd: Number(order.priceAmount) / 100,
          },
        }),
      );
      expect(response.status).toBe(503);
      expect(order.paymentStatus).toBe("pending");
    }
    expect(esimOrderCallCount()).toBe(0);
  } finally {
    lookup.mockRestore();
  }
});

test("AUDIT: Cardlink failure callback signature remains valid after changing status to SUCCESS", async () => {
  const order = fakeDb.seedOrder({
    paymentProvider: "cardlink",
    priceAmount: 1099n,
  });
  const original = {
    InvId: order.orderUuid,
    OutSum: "10.99",
    TrsId: "BILL-unpaid",
    CurrencyIn: "USD",
    Status: "FAIL",
    SignatureValue: cardlinkSign(`10.99:${order.orderUuid}`),
  };
  await handleCardlinkWebhook(post(original));
  expect(order.paymentStatus).toBe("failed");
  const response = await handleCardlinkWebhook(
    post({ ...original, Status: "SUCCESS" }),
  );
  expect(response.status).toBe(200);
  expect(order.paymentStatus).toBe("paid");
  expect(esimOrderCallCount()).toBe(1);
});

test("signed Cardlink refund cannot be redirected to a different order UUID", async () => {
  const original = fakeDb.seedOrder({
    paymentProvider: "cardlink",
    paymentStatus: "paid",
  });
  fakeDb.seedUser({ id: "user-2", telegramId: "43" });
  const victim = fakeDb.seedOrder({
    userId: "user-2",
    paymentProvider: "cardlink",
    paymentStatus: "paid",
    paymentChargeId: "BILL-victim",
  });
  const refund = {
    Id: "REF-original",
    Amount: "10.99",
    Currency: "USD",
    Status: "SUCCESS",
    InvId: original.orderUuid,
    BillId: "BILL-original",
    PaymentId: "PAY-original",
    SignatureValue: cardlinkSign(
      "10.99:USD:BILL-original:PAY-original:REF-original",
    ),
  };
  const response = await handleCardlinkRefundWebhook(
    post({ ...refund, InvId: victim.orderUuid }),
  );
  expect(response.status).toBe(200);
  expect(victim.paymentStatus).toBe("paid");
  expect(fakeDb.refundForOrder(victim.id)).toBeNull();
  expect(original.paymentStatus).toBe("paid");
});

test("webhook logger redacts bearer credentials in headers and payload", async () => {
  const handler = withWebhookLogging(
    "audit",
    async (_request, _body, _raw, persist) => {
      return (await persist()) ?? Response.json({ ok: true });
    },
  );
  await handler(
    new Request("http://localhost/api/webhooks/audit", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "fixture-webhook-secret",
      },
      body: JSON.stringify({ token: "fixture-bearer-token" }),
    }),
  );
  expect(fakeDb.webhookLogs[0]?.headers).toMatchObject({
    "x-telegram-bot-api-secret-token": "[REDACTED]",
  });
  expect(fakeDb.webhookLogs[0]?.payload).toMatchObject({
    token: "[REDACTED]",
  });
});

test("AUDIT control: changing an order UUID does not allow another user's top-up or usage lookup", async () => {
  const order = fakeDb.seedOrder({ userId: "user-1", paymentStatus: "paid" });
  expect(
    await prepareTopupPurchase({
      userId: "user-2",
      orderUuid: order.orderUuid,
      packageCode: "TOPUP_forged",
    }),
  ).toBe("not_found");
  expect(
    await checkEsimUsage({ userId: "user-2", orderUuid: order.orderUuid }),
  ).toBe("not_found");
  expect(esimOrderCallCount()).toBe(0);
});
