import "server-only";

import * as Sentry from "@sentry/nextjs";

import { miniappPublicUrl } from "~/lib/miniapp-path";
import { db } from "~/server/db";
import {
  sendMessage,
  type InlineKeyboardMarkup,
} from "~/server/telegram/bot-api";
import { esimPlanSummary } from "~/server/telegram/esim-delivery";
import {
  welcomeLocale,
  type WelcomeLocale,
} from "~/server/telegram/start-welcome";
import { miniappOrigin } from "~/server/urls";

const COPY: Record<WelcomeLocale, { ready: string; myEsims: string }> = {
  en: {
    ready: "Your top-up is successful!",
    myEsims: "My eSIMs",
  },
  ru: {
    ready: "eSIM успешно пополнена!",
    myEsims: "Мои eSIM",
  },
};

export function topupAppliedMessage(input: {
  preferredLanguage?: string | null;
  languageCode?: string | null;
  packageName: string;
  countryCode: string | null;
  dataAmountMb: number | null;
  validityDays: number;
}): { text: string; replyMarkup: InlineKeyboardMarkup } {
  const locale = welcomeLocale(
    input.preferredLanguage ?? input.languageCode,
  );
  const copy = COPY[locale];
  const { title, planLine } = esimPlanSummary({
    locale,
    packageName: input.packageName,
    countryCode: input.countryCode,
    dataAmountMb: input.dataAmountMb,
    validityDays: input.validityDays,
  });

  return {
    text: [copy.ready, "", title, planLine].join("\n"),
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: copy.myEsims,
            web_app: {
              url: miniappPublicUrl(miniappOrigin(), "/myesim"),
            },
          },
        ],
      ],
    },
  };
}

/** Tell the buyer a top-up was applied. Never rejects. */
export async function notifyBuyerTopupApplied(orderId: bigint): Promise<void> {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        packageName: true,
        countryCode: true,
        dataAmountMb: true,
        validityDays: true,
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

    const message = topupAppliedMessage({
      preferredLanguage: user.preferredLanguage,
      languageCode: user.languageCode,
      packageName: order.packageName,
      countryCode: order.countryCode,
      dataAmountMb: order.dataAmountMb,
      validityDays: order.validityDays,
    });

    await sendMessage({
      chatId,
      text: message.text,
      replyMarkup: message.replyMarkup,
      disableLinkPreview: true,
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: "telegram", reason: "topup_notice_failed" },
      extra: { orderId: orderId.toString() },
    });
  }
}
