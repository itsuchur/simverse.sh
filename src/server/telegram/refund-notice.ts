import "server-only";

import * as Sentry from "@sentry/nextjs";

import { db } from "~/server/db";
import { sendMessage } from "~/server/telegram/bot-api";
import {
  welcomeLocale,
  type WelcomeLocale,
} from "~/server/telegram/start-welcome";

const COPY: Record<
  WelcomeLocale,
  { issue: string; topup: string }
> = {
  en: {
    issue:
      "We couldn't issue your eSIM — the provider was unable to fulfill the order. Your payment has been refunded.",
    topup:
      "We couldn't apply your top-up — the provider was unable to fulfill the order. Your payment has been refunded.",
  },
  ru: {
    issue:
      "Не удалось выпустить eSIM — провайдер не смог выполнить заказ. Оплата возвращена.",
    topup:
      "Не удалось применить пополнение — провайдер не смог выполнить заказ. Оплата возвращена.",
  },
};

/** Notify the buyer once an automatic X-Hub refund has completed. */
export async function notifyBuyerRefundNotice(orderId: bigint): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      topupOfOrderId: true,
      user: {
        select: {
          telegramId: true,
          languageCode: true,
          preferredLanguage: true,
          isBanned: true,
          isDeleted: true,
        },
      },
    },
  });
  if (!order) return;

  const user = order.user;
  if (
    user.isBanned ||
    user.isDeleted ||
    typeof user.telegramId !== "string" ||
    user.telegramId.length === 0
  ) {
    return;
  }

  const chatId = Number(user.telegramId);
  if (!Number.isFinite(chatId) || chatId <= 0) {
    return;
  }

  const locale = welcomeLocale(
    user.preferredLanguage ?? user.languageCode,
  );
  const text =
    order.topupOfOrderId !== null ? COPY[locale].topup : COPY[locale].issue;

  try {
    await sendMessage({
      chatId,
      text,
      disableLinkPreview: true,
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: "telegram", reason: "refund_notice_failed" },
      extra: { orderId: order.id.toString() },
    });
  }
}
