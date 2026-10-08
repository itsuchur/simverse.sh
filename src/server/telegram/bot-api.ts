import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { env } from "~/env";

const BOT_API = "https://api.telegram.org";

type TelegramOk<T> = { ok: true; result: T };
type TelegramErr = { ok: false; description?: string };
type TelegramResponse<T> = TelegramOk<T> | TelegramErr;

async function botMethod<T>(
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(
    `${BOT_API}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  const payload = (await response.json()) as TelegramResponse<T>;
  if (!payload.ok) {
    throw new Error(
      `Telegram ${method} failed: ${payload.description ?? response.statusText}`,
    );
  }
  return payload.result;
}

export async function createInvoiceLink(input: {
  title: string;
  description: string;
  payload: string;
  amountStars: number;
  label: string;
}) {
  return botMethod<string>("createInvoiceLink", {
    title: input.title.slice(0, 32),
    description: input.description.slice(0, 255),
    payload: input.payload,
    provider_token: "",
    currency: "XTR",
    prices: [{ label: input.label.slice(0, 32), amount: input.amountStars }],
  });
}

export async function answerPreCheckoutQuery(
  preCheckoutQueryId: string,
  ok: boolean,
  errorMessage?: string,
) {
  await botMethod<boolean>("answerPreCheckoutQuery", {
    pre_checkout_query_id: preCheckoutQueryId,
    ok,
    ...(ok || !errorMessage
      ? {}
      : { error_message: errorMessage.slice(0, 200) }),
  });
}

export type InlineKeyboardButton = {
  text: string;
  url?: string;
  web_app?: { url: string };
};

export type InlineKeyboardMarkup = {
  inline_keyboard: Array<Array<InlineKeyboardButton>>;
};

export async function sendMessage(input: {
  chatId: number;
  text: string;
  parseMode?: "HTML";
  replyMarkup?: InlineKeyboardMarkup;
}) {
  return botMethod<{ message_id: number }>("sendMessage", {
    chat_id: input.chatId,
    text: input.text,
    ...(input.parseMode ? { parse_mode: input.parseMode } : {}),
    ...(input.replyMarkup ? { reply_markup: input.replyMarkup } : {}),
  });
}

export async function sendPhoto(input: {
  chatId: number;
  photo: string;
  caption?: string;
  parseMode?: "HTML";
  replyMarkup?: InlineKeyboardMarkup;
}) {
  return botMethod<{ message_id: number }>("sendPhoto", {
    chat_id: input.chatId,
    photo: input.photo,
    ...(input.caption ? { caption: input.caption } : {}),
    ...(input.parseMode ? { parse_mode: input.parseMode } : {}),
    ...(input.replyMarkup ? { reply_markup: input.replyMarkup } : {}),
  });
}

export function verifyTelegramWebhookSecret(header: string | null): boolean {
  const secret = env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || !header) {
    return false;
  }
  const a = createHash("sha256").update(header).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}
