import { beforeEach, describe, expect, mock, test } from "bun:test";

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
  answerPreCheckoutQuery,
  verifyTelegramWebhookSecret: (header: string | null) =>
    header === process.env.TELEGRAM_WEBHOOK_SECRET,
  createInvoiceLink: async () => "https://t.me/$invoice",
}));

const { POST, isStartCommand } = await import(
  "~/app/api/webhooks/telegram/route"
);
const { startWelcome } = await import("~/server/telegram/start-welcome");

const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET!;

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
    expect(expected.text).toContain("Welcome to Simverse!");
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
    expect(expected.text).toContain("Добро пожаловать");
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
    expect(order.status).toBe("issued");
    expect(sendMessage).not.toHaveBeenCalled();
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
