import { z } from "zod";

import { startCommandPayload } from "~/lib/acquisition-source";
import { paymentStatus } from "~/lib/order-status";
import { withWebhookLogging } from "~/lib/webhook-logger";
import { db } from "~/server/db";
import { fulfillStarsPayment } from "~/server/orders/fulfill";
import {
  answerPreCheckoutQuery,
  sendPhoto,
  verifyTelegramWebhookSecret,
} from "~/server/telegram/bot-api";
import { rememberTelegramStart } from "~/server/telegram/telegram-start";
import { startWelcome } from "~/server/telegram/start-welcome";

const userSchema = z.object({
  id: z.number().int(),
  language_code: z.string().optional(),
});

const preCheckoutQuerySchema = z.object({
  id: z.string().min(1),
  from: userSchema,
  currency: z.string(),
  total_amount: z.number().int(),
  invoice_payload: z.string().min(1),
});

const successfulPaymentSchema = z.object({
  currency: z.string(),
  total_amount: z.number().int(),
  invoice_payload: z.string().min(1),
  telegram_payment_charge_id: z.string().min(1),
});

const updateSchema = z.object({
  pre_checkout_query: preCheckoutQuerySchema.optional(),
  message: z
    .object({
      chat: z.object({ id: z.number().int() }).optional(),
      from: userSchema.optional(),
      text: z.string().optional(),
      successful_payment: successfulPaymentSchema.optional(),
    })
    .optional(),
});

/** `/start`, `/start@bot`, optional payload after a space. */
export function isStartCommand(text: string | undefined): boolean {
  return text !== undefined && /^\/start(?:@[A-Za-z0-9_]+)?(?:\s|$)/.test(text);
}

export const POST = withWebhookLogging(
  "telegram",
  async (request: Request, payload: unknown, _rawBody, persist) => {
    const secret = request.headers.get("x-telegram-bot-api-secret-token");
    if (!verifyTelegramWebhookSecret(secret)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const unavailable = await persist();
    if (unavailable) return unavailable;

    const parsed = updateSchema.safeParse(payload);
    if (!parsed.success) {
      return Response.json({ ok: true });
    }

    const { pre_checkout_query: query, message } = parsed.data;

    if (query) {
      try {
        const order = await db.order.findUnique({
          where: { orderUuid: query.invoice_payload },
          include: { user: { select: { telegramId: true, isBanned: true } } },
        });
        const telegramId = String(query.from.id);
        const amountOk =
          order !== null &&
          order.paymentStatus === paymentStatus.pending &&
          Number(order.priceAmount) === query.total_amount &&
          query.currency === "XTR" &&
          order.user.telegramId === telegramId;

        if (order?.user.isBanned) {
          await answerPreCheckoutQuery(
            query.id,
            false,
            "Purchases are not available.",
          );
        } else if (amountOk) {
          await answerPreCheckoutQuery(query.id, true);
        } else {
          await answerPreCheckoutQuery(
            query.id,
            false,
            "This order is no longer available.",
          );
        }
      } catch {
        try {
          await answerPreCheckoutQuery(
            query.id,
            false,
            "Could not confirm this payment. Try again.",
          );
        } catch {
          // Telegram will cancel if we cannot answer in time.
        }
      }
      return Response.json({ ok: true });
    }

    const payment = message?.successful_payment;
    const payerId = message?.from?.id;
    if (payment && payerId !== undefined) {
      await fulfillStarsPayment({
        orderUuid: payment.invoice_payload,
        telegramPaymentChargeId: payment.telegram_payment_charge_id,
        telegramId: String(payerId),
        totalAmount: payment.total_amount,
        currency: payment.currency,
      });
    } else if (isStartCommand(message?.text) && message?.chat?.id !== undefined) {
      const text = message.text ?? "";
      const telegramId =
        message.from?.id !== undefined ? String(message.from.id) : null;
      if (telegramId) {
        try {
          await rememberTelegramStart(telegramId, startCommandPayload(text));
        } catch {
          // A missed source must not block the welcome message.
        }
      }
      try {
        const user = telegramId
          ? await db.user.findUnique({
              where: { telegramId },
              select: {
                preferredLanguage: true,
                languageCode: true,
              },
            })
          : null;
        const welcome = startWelcome(
          user?.preferredLanguage ??
            user?.languageCode ??
            message.from?.language_code,
        );
        await sendPhoto({
          chatId: message.chat.id,
          photo: welcome.photo,
          caption: welcome.text,
          replyMarkup: welcome.replyMarkup,
        });
      } catch {
        // Welcome is best-effort; Telegram retries are more painful than a missed greeting.
      }
    }

    return Response.json({ ok: true });
  },
);
