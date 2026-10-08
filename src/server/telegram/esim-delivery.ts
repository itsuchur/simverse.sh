import "server-only";

import * as Sentry from "@sentry/nextjs";

import {
  esimProvisioningUrl,
  lpaCardData,
} from "~/lib/esim-provisioning";
import { db } from "~/server/db";
import {
  sendMessage,
  sendPhoto,
  type InlineKeyboardMarkup,
} from "~/server/telegram/bot-api";
import {
  welcomeLocale,
  type WelcomeLocale,
} from "~/server/telegram/start-welcome";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatDataAmount(mb: number | null): string | null {
  if (mb === null || !Number.isFinite(mb)) return null;
  if (mb >= 1024) {
    const gb = mb / 1024;
    return Number.isInteger(gb) ? `${gb} GB` : `${gb.toFixed(1)} GB`;
  }
  return `${mb} MB`;
}

function countryDisplayName(countryCode: string, locale: WelcomeLocale): string {
  try {
    return (
      new Intl.DisplayNames([locale], { type: "region" }).of(countryCode) ??
      countryCode
    );
  } catch {
    return countryCode;
  }
}

function formatDays(days: number, locale: WelcomeLocale): string {
  if (locale === "ru") {
    const mod10 = days % 10;
    const mod100 = days % 100;
    if (mod10 === 1 && mod100 !== 11) return `${days} день`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return `${days} дня`;
    }
    return `${days} дней`;
  }
  return days === 1 ? "1 day" : `${days} days`;
}

/** SM-DP+ + matching ID for phone manual entry, derived from stored credentials. */
export function manualInstallParts(
  smdpAddress: string | null,
  activationCode: string | null,
): { smdp: string; activationCode: string } | null {
  const cardData = lpaCardData(smdpAddress, activationCode);
  if (!cardData) return null;

  const parts = cardData.replace(/^LPA:/i, "").split("$");
  const smdp = parts[1]?.trim();
  const code = parts.slice(2).join("$").trim();
  if (!smdp || !code) return null;
  return { smdp, activationCode: code };
}

const COPY: Record<
  WelcomeLocale,
  {
    ready: string;
    scanOrManual: string;
    manualOnly: string;
    smdpLabel: string;
    activationLabel: string;
    installIphone: string;
    installAndroid: string;
  }
> = {
  en: {
    ready: "Your eSIM is ready!",
    scanOrManual: "Scan the QR code, or enter details manually:",
    manualOnly: "Enter details manually:",
    smdpLabel: "SM-DP+ Address",
    activationLabel: "Activation Code",
    installIphone: "Install on iPhone",
    installAndroid: "Install on Android",
  },
  ru: {
    ready: "Ваша eSIM готова!",
    scanOrManual: "Отсканируйте QR-код или введите данные вручную:",
    manualOnly: "Введите данные вручную:",
    smdpLabel: "Адрес SM-DP+",
    activationLabel: "Код активации",
    installIphone: "Установить на iPhone",
    installAndroid: "Установить на Android",
  },
};

export function esimDeliveryMessage(input: {
  languageCode?: string | null;
  packageName: string;
  countryCode: string | null;
  dataAmountMb: number | null;
  validityDays: number;
  smdpAddress: string | null;
  activationCode: string | null;
  hasQr: boolean;
}): {
  text: string;
  replyMarkup: InlineKeyboardMarkup;
  cardData: string;
} | null {
  const manual = manualInstallParts(input.smdpAddress, input.activationCode);
  const cardData = lpaCardData(input.smdpAddress, input.activationCode);
  if (!manual || !cardData) return null;

  const locale = welcomeLocale(input.languageCode);
  const copy = COPY[locale];

  const title =
    input.countryCode && !input.countryCode.includes(",")
      ? countryDisplayName(input.countryCode, locale)
      : input.packageName;

  const data = formatDataAmount(input.dataAmountMb);
  const days = formatDays(input.validityDays, locale);
  const planLine = data ? `${data} · ${days}` : days;

  const text = [
    copy.ready,
    "",
    escapeHtml(title),
    escapeHtml(planLine),
    "",
    input.hasQr ? copy.scanOrManual : copy.manualOnly,
    "",
    `${copy.smdpLabel}:`,
    `<code>${escapeHtml(manual.smdp)}</code>`,
    "",
    `${copy.activationLabel}:`,
    `<code>${escapeHtml(manual.activationCode)}</code>`,
  ].join("\n");

  return {
    text,
    cardData,
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: copy.installIphone,
            url: esimProvisioningUrl("apple", cardData),
          },
        ],
        [
          {
            text: copy.installAndroid,
            url: esimProvisioningUrl("android", cardData),
          },
        ],
      ],
    },
  };
}

export async function notifyBuyerEsimDelivery(orderId: bigint): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      packageName: true,
      countryCode: true,
      dataAmountMb: true,
      validityDays: true,
      esimQrUrl: true,
      esimSmdpAddress: true,
      esimActivationCode: true,
      user: {
        select: {
          telegramId: true,
          languageCode: true,
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

  const hasQr =
    typeof order.esimQrUrl === "string" && order.esimQrUrl.length > 0;
  const message = esimDeliveryMessage({
    languageCode: user.languageCode,
    packageName: order.packageName,
    countryCode: order.countryCode,
    dataAmountMb: order.dataAmountMb,
    validityDays: order.validityDays,
    smdpAddress: order.esimSmdpAddress,
    activationCode: order.esimActivationCode,
    hasQr,
  });
  if (!message) return;

  try {
    if (hasQr && order.esimQrUrl) {
      await sendPhoto({
        chatId,
        photo: order.esimQrUrl,
        caption: message.text,
        parseMode: "HTML",
        replyMarkup: message.replyMarkup,
      });
      return;
    }

    await sendMessage({
      chatId,
      text: message.text,
      parseMode: "HTML",
      replyMarkup: message.replyMarkup,
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: "telegram", reason: "esim_delivery_failed" },
      extra: { orderId: order.id.toString() },
    });
  }
}
