import { z } from "zod";

import { withWebhookLogging } from "~/lib/webhook-logger";
import { paymentStatus } from "~/lib/order-status";
import { db } from "~/server/db";
import { fulfillStarsPayment } from "~/server/orders/fulfill";
import {
  answerPreCheckoutQuery,
  verifyTelegramWebhookSecret,
} from "~/server/telegram/bot-api";

const userSchema = z.object({
  id: z.number().int(),
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
      from: userSchema.optional(),
      successful_payment: successfulPaymentSchema.optional(),
    })
    .optional(),
});

export const POST = withWebhookLogging(
  "telegram",
  async (request: Request, payload: unknown) => {
    const secret = request.headers.get("x-telegram-bot-api-secret-token");
    if (!verifyTelegramWebhookSecret(secret)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = updateSchema.safeParse(payload);
    if (!parsed.success) {
      return Response.json({ ok: true });
    }

    const { pre_checkout_query: query, message } = parsed.data;

    if (query) {
      try {
        const order = await db.order.findUnique({
          where: { orderUuid: query.invoice_payload },
          include: { user: { select: { telegramId: true } } },
        });
        const telegramId = String(query.from.id);
        const amountOk =
          order !== null &&
          order.paymentStatus === paymentStatus.pending &&
          Number(order.priceAmount) === query.total_amount &&
          query.currency === "XTR" &&
          order.user.telegramId === telegramId;

        if (amountOk) {
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
      });
    }

    return Response.json({ ok: true });
  },
);
