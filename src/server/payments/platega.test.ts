import { afterEach, describe, expect, mock, test } from "bun:test";

import {
  createPlategaTransaction,
  plategaPaymentMethod,
  verifyPlategaCallbackCredentials,
} from "~/server/payments/platega";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("Platega payment client", () => {
  test("maps local and international currencies to their payment methods", () => {
    expect(plategaPaymentMethod("RUB")).toBe(11);
    expect(plategaPaymentMethod("USD")).toBe(12);
  });

  test("creates an authenticated transaction with the order payload", async () => {
    const fetchMock = mock(
      async (
        _input: Parameters<typeof fetch>[0],
        _init?: Parameters<typeof fetch>[1],
      ) =>
        Response.json({
          transactionId: "00000000-0000-4000-8000-000000000001",
          redirect: "https://pay.platega.io/transaction",
          status: "PENDING",
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const transaction = await createPlategaTransaction({
      amount: 10.99,
      orderId: "00000000-0000-4000-8000-000000000002",
      description: "Test eSIM",
      currency: "USD",
      paymentMethod: 2,
      returnUrl: "https://example.com/success",
      failedUrl: "https://example.com/fail",
    });

    expect(transaction.redirect).toBe("https://pay.platega.io/transaction");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://app.platega.io/transaction/process");
    expect(init?.headers).toEqual({
      "Content-Type": "application/json",
      "X-MerchantId": "test-platega-merchant",
      "X-Secret": "test-platega-secret",
    });
    const requestBody = init?.body;
    expect(typeof requestBody).toBe("string");
    if (typeof requestBody !== "string") {
      throw new Error("Expected a JSON request body");
    }
    expect(JSON.parse(requestBody)).toMatchObject({
      paymentMethod: 2,
      paymentDetails: { amount: 10.99, currency: "USD" },
      payload: "00000000-0000-4000-8000-000000000002",
      orderId: "00000000-0000-4000-8000-000000000002",
    });
  });

  test("verifies both callback credentials", () => {
    expect(
      verifyPlategaCallbackCredentials({
        merchantId: "test-platega-merchant",
        secret: "test-platega-secret",
      }),
    ).toBe(true);
    expect(
      verifyPlategaCallbackCredentials({
        merchantId: "test-platega-merchant",
        secret: "wrong",
      }),
    ).toBe(false);
  });
});
