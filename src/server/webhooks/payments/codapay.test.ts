import { afterEach, beforeEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { fakeDb } from "~/test/fake-db";
import {
  resetTestState,
  stubEsimAccess,
  esimOrderCallCount,
} from "~/test/mocks";
import { handleCodapayWebhook } from "./codapay";
import { createCodapayInvoice } from "~/server/payments/codapay";

const originalFetch = globalThis.fetch;
const txnId = "7715122576202672831";
beforeEach(() => {
  resetTestState();
  fakeDb.seedUser({ id: "user-1", telegramId: "42" });
  stubEsimAccess({
    profiles: [
      {
        iccid: "89000000000000000010",
        ac: "LPA:1$rsp.example.com$TEST",
        smdpAddress: "rsp.example.com",
      },
    ],
  });
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function seed() {
  return fakeDb.seedOrder({
    paymentProvider: "codapay",
    paymentInvoiceId: txnId,
    priceAmount: 1099n,
    currency: "USD",
  });
}
function request(
  orderId: string,
  code = "0",
  extra: Record<string, string> = {},
) {
  const params = new URLSearchParams({
    TxnId: txnId,
    OrderId: orderId,
    ResultCode: code,
    TotalPrice: "42.00",
    USDPrice: "10.99",
    Checksum: createHash("md5")
      .update(`${txnId}test-codapay-key${orderId}${code}`)
      .digest("hex"),
    ...extra,
  });
  return new Request(
    `https://api.simverse.sh/webhooks/payments/codapay?${params}`,
  );
}
function inquiry(orderId: string, code = "0", amount = "10.99") {
  globalThis.fetch = (async () =>
    new Response(
      `{"paymentResult":{"txnId":${txnId},"orderId":"${orderId}","resultCode":${code},"originCurrency":"USD","originAmount":${amount}}}`,
    )) as unknown as typeof fetch;
}

test("success verifies USD via inquiry, preserves large IDs and fulfills once", async () => {
  const order = seed();
  inquiry(order.orderUuid);
  expect(
    await (await handleCodapayWebhook(request(order.orderUuid))).text(),
  ).toBe("ResultCode=0");
  await handleCodapayWebhook(request(order.orderUuid));
  expect(order.paymentStatus).toBe("paid");
  expect(order.paymentChargeId).toBe(txnId);
  expect(esimOrderCallCount()).toBe(1);
  expect(fakeDb.webhookLogs[0]?.payload).toMatchObject({
    USDPrice: "10.99",
    Checksum: "[REDACTED]",
  });
});

test("failed notification closes pending order; late failure cannot undo a payment", async () => {
  const order = seed();
  inquiry(order.orderUuid, "750");
  expect(
    await (await handleCodapayWebhook(request(order.orderUuid, "750"))).text(),
  ).toBe("ResultCode=0");
  expect(order.paymentStatus).toBe("failed");
  inquiry(order.orderUuid);
  await handleCodapayWebhook(request(order.orderUuid));
  expect(order.paymentStatus).toBe("paid");
  inquiry(order.orderUuid, "750");
  await handleCodapayWebhook(request(order.orderUuid, "750"));
  expect(order.paymentStatus).toBe("paid");
});

test("forged signatures and duplicate parameters never persist or fulfill", async () => {
  const order = seed();
  expect(
    (
      await handleCodapayWebhook(
        request(order.orderUuid, "0", { Checksum: "0".repeat(32) }),
      )
    ).status,
  ).toBe(401);
  const duplicate = new Request(request(order.orderUuid).url + "&TxnId=1");
  expect((await handleCodapayWebhook(duplicate)).status).toBe(400);
  expect(fakeDb.webhookLogs).toHaveLength(0);
  expect(esimOrderCallCount()).toBe(0);
});

test("unsigned callback amounts cannot override inquiry amount; API failures request retry", async () => {
  const order = seed();
  inquiry(order.orderUuid, "0", "1.00");
  expect((await handleCodapayWebhook(request(order.orderUuid))).status).toBe(
    503,
  );
  globalThis.fetch = (async () =>
    new Response("Unavailable", { status: 503 })) as unknown as typeof fetch;
  expect((await handleCodapayWebhook(request(order.orderUuid))).status).toBe(
    503,
  );
  expect(order.paymentStatus).toBe("pending");
  expect(esimOrderCallCount()).toBe(0);
});

test("pending inquiry is acknowledged without fulfillment; mismatched invoice fails", async () => {
  const order = seed();
  inquiry(order.orderUuid, "481");
  expect((await handleCodapayWebhook(request(order.orderUuid))).status).toBe(
    200,
  );
  expect(order.paymentStatus).toBe("pending");
  order.paymentInvoiceId = "123";
  expect((await handleCodapayWebhook(request(order.orderUuid))).status).toBe(
    503,
  );
});

test("sandbox initiation uses v2 USD, project, card market and exact transaction ID", async () => {
  let body: Record<string, unknown> = {};
  globalThis.fetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    expect(url).toBe(
      "https://sandbox.codapayments.com/airtime/api/restful/v2.0/Payment/init.json",
    );
    if (typeof init?.body !== "string")
      throw new Error("Expected JSON request body");
    body = JSON.parse(init.body) as Record<string, unknown>;
    return new Response(
      `{"initResult":{"resultCode":0,"txnId":${txnId},"redirectUrl":"https://sandbox.codapayments.com/airtime/begin?txn_id=${txnId}"}}`,
    );
  }) as unknown as typeof fetch;
  const result = await createCodapayInvoice({
    amount: 1099n,
    orderId: crypto.randomUUID(),
    userId: "user-1",
    country: "KZ",
  });
  expect(result.id).toBe(txnId);
  expect(body.initRequest).toMatchObject({
    projectId: "4378",
    country: 398,
    payType: 0,
    currency: 840,
    items: [{ name: "Simverse eSIM", price: 10.99 }],
  });
});
