import { beforeEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { recoverPendingOrders } from "~/server/orders/fulfill";
import { handleUnitpayWebhook } from "./unitpay";
import { fakeDb } from "~/test/fake-db";
import {
  esimOrderCallCount,
  resetTestState,
  stubEsimAccess,
} from "~/test/mocks";

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
function seed() {
  return fakeDb.seedOrder({
    paymentProvider: "unitpay",
    paymentInvoiceId: "987",
    priceAmount: 1099n,
    currency: "USD",
  });
}
function request(
  account: string,
  method = "pay",
  extra: Record<string, string> = {},
  headers: Record<string, string> = {
    "cf-connecting-ip": "31.186.100.49",
    "x-forwarded-for": "203.0.113.10, 172.64.0.1",
  },
) {
  const params: Record<string, string> = {
    account,
    projectId: "123456",
    unitpayId: "987",
    orderSum: "10.99",
    orderCurrency: "USD",
    test: "0",
    ...extra,
  };
  params.signature = createHash("sha256")
    .update(
      [
        method,
        ...Object.keys(params)
          .sort()
          .map((key) => params[key]),
        "test-unitpay-secret",
      ].join("{up}"),
    )
    .digest("hex");
  const url = new URL("https://api.simverse.sh/webhooks/payments/unitpay");
  url.searchParams.set("method", method);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(`params[${key}]`, value);
  return new Request(url, { headers });
}

test("Cloudflare client IP is used and repeated PAY issues only one eSIM", async () => {
  const order = seed();
  expect(
    await (await handleUnitpayWebhook(request(order.orderUuid))).json(),
  ).toHaveProperty("result");
  await handleUnitpayWebhook(request(order.orderUuid));
  await recoverPendingOrders();
  expect(order.status).toBe("issued");
  expect(esimOrderCallCount()).toBe(1);
  expect(fakeDb.webhookLogs[0]?.payload).toMatchObject({
    method: "pay",
    params: { signature: "[REDACTED]" },
  });
});

test("forged forwarding headers, missing CF header and disallowed CF address fail closed", async () => {
  const order = seed();
  const headerCases: Record<string, string>[] = [
    { "x-forwarded-for": "31.186.100.49" },
    { "cf-connecting-ip": "203.0.113.1", "x-forwarded-for": "31.186.100.49" },
    { "cf-connecting-ip": "31.186.100.49, 203.0.113.1" },
  ];
  for (const headers of headerCases) {
    expect(
      (await handleUnitpayWebhook(request(order.orderUuid, "pay", {}, headers)))
        .status,
    ).toBe(403);
  }
  expect(fakeDb.webhookLogs).toHaveLength(0);
});

test("CHECK and PREAUTH never fulfill; ERROR can be followed by PAY", async () => {
  const order = seed();
  for (const method of ["check", "preauth"]) {
    expect(
      await (
        await handleUnitpayWebhook(request(order.orderUuid, method))
      ).json(),
    ).toHaveProperty("result");
    expect(order.paymentStatus).toBe("pending");
  }
  await handleUnitpayWebhook(request(order.orderUuid, "error"));
  expect(order.paymentStatus).toBe("failed");
  await handleUnitpayWebhook(request(order.orderUuid));
  await recoverPendingOrders();
  expect(order.status).toBe("issued");
});

test("wrong project, amount, currency, payment ID and test payments never fulfill", async () => {
  const order = seed();
  const paramCases: Record<string, string>[] = [
    { projectId: "999" },
    { orderSum: "10.98" },
    { orderCurrency: "RUB" },
    { unitpayId: "988" },
    { test: "1" },
  ];
  for (const extra of paramCases) {
    expect(
      await (
        await handleUnitpayWebhook(request(order.orderUuid, "pay", extra))
      ).json(),
    ).toHaveProperty("error");
  }
  expect(order.paymentStatus).toBe("pending");
  expect(esimOrderCallCount()).toBe(0);
});

test("tampered signatures and duplicate parameters are rejected", async () => {
  const order = seed();
  const valid = request(order.orderUuid);
  const url = new URL(valid.url);
  url.searchParams.set("params[orderSum]", "1.00");
  expect(
    (await handleUnitpayWebhook(new Request(url, { headers: valid.headers })))
      .status,
  ).toBe(401);
  url.searchParams.append("params[orderSum]", "10.99");
  expect(
    await (
      await handleUnitpayWebhook(new Request(url, { headers: valid.headers }))
    ).json(),
  ).toHaveProperty("error");
  expect(fakeDb.webhookLogs).toHaveLength(0);
});
