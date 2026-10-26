import { rejects } from "node:assert/strict";
import { afterEach, expect, mock, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  createUnitpayPayment,
  refundUnitpayPayment,
  unitpayAmountToMinor,
  verifyUnitpaySignature,
} from "./unitpay";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("signature covers sorted parameters, unknown fields and method", () => {
  const signature = createHash("sha256")
    .update("pay{up}first{up}last{up}test-unitpay-secret")
    .digest("hex");
  expect(
    verifyUnitpaySignature("pay", { z: "last", a: "first", signature }),
  ).toBe(true);
  expect(
    verifyUnitpaySignature("check", { z: "last", a: "first", signature }),
  ).toBe(false);
  expect(
    verifyUnitpaySignature("pay", {
      z: "last",
      a: "first",
      extra: "value",
      signature,
    }),
  ).toBe(false);
  expect(verifyUnitpaySignature("pay", { signature: "invalid" })).toBe(false);
});

test("amount parsing is exact and rejects ambiguous formats", () => {
  expect(unitpayAmountToMinor("10.99")).toBe(1099n);
  expect(unitpayAmountToMinor("10.9")).toBe(1090n);
  for (const value of ["-1", "1e2", "1.001", "NaN", "1,00", ""])
    expect(() => unitpayAmountToMinor(value)).toThrow();
});

test("redirect checkout sends card, project, currency and return URLs and stores payment ID", async () => {
  const http = mock(async (_url: unknown, _init?: RequestInit) =>
    Response.json({
      result: {
        type: "redirect",
        paymentId: 987,
        redirectUrl: "https://unitpay.money/pay/test",
      },
    }),
  );
  globalThis.fetch = http as unknown as typeof fetch;
  expect(
    await createUnitpayPayment({
      amount: "10.99",
      orderUuid: "order",
      currency: "USD",
      locale: "en",
      description: "eSIM",
      resultUrl:
        "https://miniapp.simverse.sh/api/checkout/unitpay/return?status=success",
      backUrl:
        "https://miniapp.simverse.sh/api/checkout/unitpay/return?status=fail",
    }),
  ).toEqual({ id: "987", url: "https://unitpay.money/pay/test" });
  const url = new URL(String(http.mock.calls[0]![0]));
  expect(Object.fromEntries(url.searchParams)).toMatchObject({
    method: "initPayment",
    paymentType: "card",
    projectId: "123456",
    secretKey: "test-unitpay-secret",
    currency: "USD",
    sum: "10.99",
    hideOtherMethods: "true",
  });
  expect(http.mock.calls[0]![1]?.cache).toBe("no-store");
});

test("HTTP 200 API errors fail and transport errors never expose the secret URL", async () => {
  globalThis.fetch = mock(async () =>
    Response.json({ error: { code: -32000, message: "bad credentials" } }),
  ) as unknown as typeof fetch;
  await rejects(
    refundUnitpayPayment("987"),
    new RegExp("refundPayment failed"),
  );
  globalThis.fetch = mock(async () => {
    throw new Error("https://unitpay.money/api?secretKey=test-unitpay-secret");
  }) as unknown as typeof fetch;
  await rejects(
    refundUnitpayPayment("987"),
    new RegExp("Unitpay refundPayment outcome unknown"),
  );
});
