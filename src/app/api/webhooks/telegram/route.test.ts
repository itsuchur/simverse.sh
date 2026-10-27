import { beforeEach, describe, expect, mock, test } from "bun:test";

import { recoverPendingOrders } from "~/server/orders/fulfill";
import { fakeDb } from "~/test/fake-db";
import { resetTestState, stubEsimAccess } from "~/test/mocks";

process.env.TELEGRAM_WEBHOOK_SECRET ??=
  "0123456789abcdef0123456789abcdef";

const sendMessage = mock(
  async (_input: {
    chatId: number;
    text: string;
    replyMarkup?: unknown;
  }) => ({ message_id: 1 }),
);

const answerPreCheckoutQuery = mock(
  async (_id: string, _ok: boolean, _error?: string) => undefined,
);

void mock.module("~/server/telegram/bot-api", () => ({
  sendMessage,
  sendPhoto: async () => ({ message_id: 1 }),
  answerPreCheckoutQuery,
  verifyTelegramWebhookSecret: (header: string | null) =>
    header === process.env.TELEGRAM_WEBHOOK_SECRET,
  createInvoiceLink: async () => "https://t.me/$invoice",
}));

const { POST, isStartCommand } = await import(
  "~/app/api/webhooks/telegram/route"
);
const { startWelcome } = await import("~/server/telegram/start-welcome");

const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

function postUpdate(payload: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/webhooks/telegram", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": SECRET,
      },
      body: JSON.stringify(payload),
    }),
  );
}

beforeEach(() => {
  resetTestState();
  sendMessage.mockClear();
  answerPreCheckoutQuery.mockClear();
});

describe("isStartCommand", () => {
  test("matches /start variants", () => {
    expect(isStartCommand("/start")).toBe(true);
    expect(isStartCommand("/start@test_bot")).toBe(true);
    expect(isStartCommand("/start payload")).toBe(true);
    expect(isStartCommand("/start@test_bot payload")).toBe(true);
    expect(isStartCommand("/help")).toBe(false);
    expect(isStartCommand("start")).toBe(false);
    expect(isStartCommand(undefined)).toBe(false);
  });
});

describe("telegram webhook auth", () => {
  test("rejects invalid secret without logging", async () => {
    const response = await POST(
      new Request("http://localhost/api/webhooks/telegram", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-telegram-bot-api-secret-token": "wrong-secret",
        },
        body: JSON.stringify({ message: { text: "/start", chat: { id: 1 } } }),
      }),
    );

    expect(response.status).toBe(401);
    expect(fakeDb.webhookLogs).toHaveLength(0);
  });
});

describe("telegram webhook /start", () => {
  test("sends English welcome for /start without language_code", async () => {
    const response = await postUpdate({
      message: {
        chat: { id: 100 },
        from: { id: 42 },
        text: "/start",
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(sendMessage).toHaveBeenCalledTimes(1);
    const expected = startWelcome(undefined);
    expect(sendMessage.mock.calls[0]?.[0]).toEqual({
      chatId: 100,
      text: expected.text,
      replyMarkup: expected.replyMarkup,
    });
    expect(expected.text).toContain("We sell travel eSIMs");
    expect(expected.text).not.toContain("Welcome to Simverse");
    expect(fakeDb.webhookLogs).toHaveLength(1);
    expect(fakeDb.webhookLogs[0]?.source).toBe("telegram");
  });

  test("sends Russian welcome when language_code starts with ru", async () => {
    const response = await postUpdate({
      message: {
        chat: { id: 101 },
        from: { id: 42, language_code: "ru" },
        text: "/start@test_bot",
      },
    });

    expect(response.status).toBe(200);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    const expected = startWelcome("ru");
    expect(sendMessage.mock.calls[0]?.[0]).toEqual({
      chatId: 101,
      text: expected.text,
      replyMarkup: expected.replyMarkup,
    });
    expect(expected.text).toContain("Мы продаём travel eSIM");
    expect(expected.text).not.toContain("Добро пожаловать");
  });

  test("prefers preferredLanguage over Telegram language_code", async () => {
    fakeDb.seedUser({
      id: "user-pref",
      telegramId: "42",
      preferredLanguage: "ru",
      languageCode: "en",
    });

    const response = await postUpdate({
      message: {
        chat: { id: 102 },
        from: { id: 42, language_code: "en" },
        text: "/start",
      },
    });

    expect(response.status).toBe(200);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    const expected = startWelcome("ru");
    expect(sendMessage.mock.calls[0]?.[0]).toEqual({
      chatId: 102,
      text: expected.text,
      replyMarkup: expected.replyMarkup,
    });
  });

  test("remembers the first /start source and lets a later one update latest", async () => {
    await postUpdate({
      message: {
        chat: { id: 100 },
        from: { id: 42 },
        text: "/start src_instagram",
      },
    });
    await postUpdate({
      message: {
        chat: { id: 100 },
        from: { id: 42 },
        text: "/start@test_bot src_youtube",
      },
    });

    const row = await fakeDb.telegramStart.findUnique({
      where: { telegramId: "42" },
    });
    expect(row?.firstSource).toBe("src_instagram");
    expect(row?.latestSource).toBe("src_youtube");
  });

  test("a payment /start payload is not an acquisition source", async () => {
    await postUpdate({
      message: {
        chat: { id: 100 },
        from: { id: 42 },
        text: "/start successful_payment",
      },
    });

    const row = await fakeDb.telegramStart.findUnique({
      where: { telegramId: "42" },
    });
    expect(row).toBeNull();
  });

  test("unknown messages are a noop", async () => {
    const response = await postUpdate({
      message: {
        chat: { id: 100 },
        from: { id: 42 },
        text: "hello",
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  test("successful_payment still fulfills Stars orders", async () => {
    fakeDb.seedUser({ id: "user-1", telegramId: "42" });
    const order = fakeDb.seedOrder({
      paymentProvider: "telegram_stars",
      currency: "XTR",
      priceAmount: 370n,
    });
    stubEsimAccess({
      orderNo: "EA-1",
      profiles: [
        {
          iccid: "89000000000000000010",
          ac: "LPA:1$rsp.example.com$STARS1",
          qrCodeUrl: "https://qr.example/10",
          smdpAddress: "rsp.example.com",
          esimStatus: "GOT_RESOURCE",
          smdpStatus: "RELEASED",
        },
      ],
    });

    const response = await postUpdate({
      message: {
        from: { id: 42 },
        successful_payment: {
          currency: "XTR",
          total_amount: 370,
          invoice_payload: order.orderUuid,
          telegram_payment_charge_id: "tg-charge-1",
        },
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(order.paymentStatus).toBe("paid");
    expect(order.status).toBe("ordering");
    expect(order.resellerOrderId).toBe("EA-1");
    expect(sendMessage).not.toHaveBeenCalled();
    await recoverPendingOrders();
    expect(order.status).toBe("issued");
  });

  test("sendMessage failures still return ok", async () => {
    sendMessage.mockImplementationOnce(async () => {
      throw new Error("telegram down");
    });

    const response = await postUpdate({
      message: {
        chat: { id: 100 },
        from: { id: 42 },
        text: "/start",
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
