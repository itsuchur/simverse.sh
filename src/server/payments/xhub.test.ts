import { createHmac } from "node:crypto";

import { afterEach, describe, expect, mock, test } from "bun:test";

import {
  createXhubPayment,
  formatXhubAmountRub,
  verifyXhubWebhookSignature,
} from "~/server/payments/xhub";

const originalFetch = globalThis.fetch;
const WEBHOOK_SECRET = "test-xhub-webhook-secret";

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("X-Hub payment client", () => {
  test("formats RUB amounts with two decimal places", () => {
    expect(formatXhubAmountRub(500)).toBe("500.00");
    expect(formatXhubAmountRub(10.5)).toBe("10.50");
    expect(formatXhubAmountRub(10.99)).toBe("10.99");
  });

  test("creates an authenticated payment with the order payload", async () => {
    const fetchMock = mock(
      async (
        _input: Parameters<typeof fetch>[0],
        _init?: Parameters<typeof fetch>[1],
      ) =>
        Response.json({
          id: "pay_550e8400-e29b-41d4-a716-446655440000",
          payment_url: "https://qr.nspk.ru/BD10100NR0811JNT8FAQG039UTUIDSOM",
          status: "pending",
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const payment = await createXhubPayment({
      amountRub: 500,
      orderUuid: "00000000-0000-4000-8000-000000000002",
      paymentMethod: "sbp",
      description: "Test eSIM · 7d",
      successUrl: "https://example.com/success",
      clientIp: "203.0.113.24",
    });

    expect(payment).toEqual({
      id: "pay_550e8400-e29b-41d4-a716-446655440000",
      paymentUrl: "https://qr.nspk.ru/BD10100NR0811JNT8FAQG039UTUIDSOM",
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.x-hub.online/api/v1/payments");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      "Content-Type": "application/json",
      "X-Api-Key": "xh_test_key",
      "X-Api-Secret": "test-xhub-api-secret",
      "Idempotency-Key": "00000000-0000-4000-8000-000000000002",
    });
    const requestBody = init?.body;
    expect(typeof requestBody).toBe("string");
    if (typeof requestBody !== "string") {
      throw new Error("Expected a JSON request body");
    }
    expect(JSON.parse(requestBody)).toEqual({
      amount_rub: "500.00",
      external_id: "00000000-0000-4000-8000-000000000002",
      payment_method: "sbp",
      description: "Test eSIM · 7d",
      success_url: "https://example.com/success",
      client_info: { ip: "203.0.113.24" },
    });
  });

  test("creates a card payment without client_info when IP is omitted", async () => {
    const fetchMock = mock(
      async (
        _input: Parameters<typeof fetch>[0],
        _init?: Parameters<typeof fetch>[1],
      ) =>
        Response.json({
          id: "pay_7c1e2f3a-9b04-4f1d-8a52-1c6d0b3e77af",
          payment_url:
            "https://api.x-hub.online/r/7c1e2f3a-9b04-4f1d-8a52-1c6d0b3e77af",
          status: "pending",
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await createXhubPayment({
      amountRub: 299.5,
      orderUuid: "00000000-0000-4000-8000-000000000003",
      paymentMethod: "card",
      description: "Test eSIM · 15d",
      successUrl: "https://example.com/success",
    });

    const requestBody = fetchMock.mock.calls[0]?.[1]?.body;
    expect(typeof requestBody).toBe("string");
    if (typeof requestBody !== "string") {
      throw new Error("Expected a JSON request body");
    }
    expect(JSON.parse(requestBody)).toEqual({
      amount_rub: "299.50",
      external_id: "00000000-0000-4000-8000-000000000003",
      payment_method: "card",
      description: "Test eSIM · 15d",
      success_url: "https://example.com/success",
    });
  });

  test("verifies a fresh webhook signature", () => {
    const timestamp = new Date().toISOString();
    const rawBody = JSON.stringify({ event: "payment.status_changed" });
    const signature =
      "sha256=" +
      createHmac("sha256", WEBHOOK_SECRET)
        .update(`${timestamp}.${rawBody}`)
        .digest("hex");

    expect(
      verifyXhubWebhookSignature({
        rawBody,
        signature,
        timestamp,
      }),
    ).toBe(true);
    expect(
      verifyXhubWebhookSignature({
        rawBody,
        signature: "sha256=deadbeef",
        timestamp,
      }),
    ).toBe(false);
  });

  test("rejects webhook signatures older than five minutes", () => {
    const nowMs = Date.parse("2026-04-14T13:10:00.000Z");
    const timestamp = "2026-04-14T13:00:00.000Z";
    const rawBody = "{}";
    const signature =
      "sha256=" +
      createHmac("sha256", WEBHOOK_SECRET)
        .update(`${timestamp}.${rawBody}`)
        .digest("hex");

    expect(
      verifyXhubWebhookSignature({
        rawBody,
        signature,
        timestamp,
        nowMs,
      }),
    ).toBe(false);
  });
});
