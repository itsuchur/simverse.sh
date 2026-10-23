import { beforeEach, expect, test } from "bun:test";
import { withWebhookLogging } from "~/lib/webhook-logger";
import { fakeDb } from "~/test/fake-db";
import { resetTestState } from "~/test/mocks";

beforeEach(resetTestState);

test("webhook handlers receive original credentials while logs contain only redacted copies", async () => {
  const payload = {
    order_id: "order-123",
    invoice_id: "invoice-123",
    token: "jwt-secret",
    nested: [
      {
        API_KEY: "sensitive-api-value",
        SignatureValue: "signature-secret",
        amount: 10,
      },
    ],
  };
  const handler = withWebhookLogging(
    "test",
    async (request, body, raw, persist) => {
      expect(body).toEqual(payload);
      expect(raw).toBe(JSON.stringify(payload));
      expect(request.headers.get("x-telegram-bot-api-secret-token")).toBe(
        "telegram-secret",
      );
      return (await persist()) ?? Response.json({ ok: true });
    },
  );
  expect(
    (
      await handler(
        new Request("http://localhost/webhook", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer auth-secret",
            cookie: "session=cookie-secret",
            "x-secret": "platega-secret",
            "x-telegram-bot-api-secret-token": "telegram-secret",
            "x-original-uri": "/webhook?token=url-secret",
            "x-request-id": "request-123",
          },
          body: JSON.stringify(payload),
        }),
      )
    ).status,
  ).toBe(200);
  const log = fakeDb.webhookLogs[0];
  const stored = JSON.stringify({
    headers: log?.headers,
    payload: log?.payload,
  });
  for (const secret of [
    "jwt-secret",
    "sensitive-api-value",
    "signature-secret",
    "auth-secret",
    "cookie-secret",
    "platega-secret",
    "telegram-secret",
    "url-secret",
  ]) {
    expect(stored).not.toContain(secret);
  }
  expect(log?.payload).toMatchObject({
    order_id: "order-123",
    invoice_id: "invoice-123",
    token: "[REDACTED]",
    nested: [{ amount: 10 }],
  });
  expect(log?.headers).toMatchObject({ "x-request-id": "request-123" });
});

test("form-encoded credentials are redacted and unparsed bodies are not retained", async () => {
  const handler = withWebhookLogging(
    "test",
    async (_request, _body, _raw, persist) =>
      (await persist()) ?? Response.json({ ok: true }),
  );
  await handler(
    new Request("http://localhost/webhook", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "InvId=order-1&SignatureValue=form-secret",
    }),
  );
  expect(fakeDb.webhookLogs[0]?.payload).toEqual({
    InvId: "order-1",
    SignatureValue: "[REDACTED]",
  });
  await handler(
    new Request("http://localhost/webhook", {
      method: "POST",
      body: "malformed secret-token",
    }),
  );
  expect(fakeDb.webhookLogs[1]?.payload).toBe("[UNPARSED BODY]");
});
