import "server-only";

import * as Sentry from "@sentry/nextjs";

import {
  esimProvisioningUrl,
  lpaCardData,
} from "~/lib/esim-provisioning";
import { miniappPublicUrl } from "~/lib/miniapp-path";
import { db } from "~/server/db";
import { isFupPackageName } from "~/server/suppliers/esimaccess/parse-package-name";
import {
  sendMessage,
  sendPhoto,
  type InlineKeyboardMarkup,
} from "~/server/telegram/bot-api";
import {
  welcomeLocale,
  type WelcomeLocale,
} from "~/server/telegram/start-welcome";
import { miniappOrigin } from "~/server/urls";

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
    thanks: string;
    unlimited: string;
    scanOrManual: string;
    manualOnly: string;
    smdpLabel: string;
    activationLabel: string;
    useInstallButtons: string;
    installIphone: string;
    installAndroid: string;
    myEsims: string;
    installGuide: string;
    installGuideUrl: string;
    saveDataGuide: string;
    saveDataGuideUrl: string;
  }
> = {
  en: {
    ready: "Your eSIM is ready!",
    thanks: "Thank you for buying an eSIM.",
    unlimited: "Unlimited",
    scanOrManual: "Scan the QR code, or enter details manually:",
    manualOnly: "Enter details manually:",
    smdpLabel: "SM-DP+ Address",
    activationLabel: "Activation Code",
    useInstallButtons: "Use the buttons below to install the eSIM.",
    installIphone: "Install on iPhone",
    installAndroid: "Install on Android",
    myEsims: "My eSIMs",
    installGuide: "How to install an eSIM?",
    installGuideUrl: "https://blog.simverse.sh/how-to-install-an-e-sim",
    saveDataGuide: "How to Save Mobile Data",
    saveDataGuideUrl: "https://blog.simverse.sh/how-to-save-mobile-data",
  },
  ru: {
    ready: "Ваша eSIM готова!",
    thanks: "Спасибо за покупку eSIM.",
    unlimited: "Безлимит",
    scanOrManual: "Отсканируйте QR-код или введите данные вручную:",
    manualOnly: "Введите данные вручную:",
    smdpLabel: "Адрес SM-DP+",
    activationLabel: "Код активации",
    useInstallButtons: "Используйте кнопки ниже, чтобы установить eSIM.",
    installIphone: "Установить на iPhone",
    installAndroid: "Установить на Android",
    myEsims: "Мои eSIM",
    installGuide: "Как установить eSIM?",
    installGuideUrl: "https://blog.simverse.sh/ru/kak-ustanovit-e-sim",
    saveDataGuide: "Как уменьшить расход данных в поездке",
    saveDataGuideUrl:
      "https://blog.simverse.sh/ru/kak-umenshit-rashod-mobilnyh-dannyh-v-poezdke",
  },
};

function guideLink(label: string, url: string): string {
  return `<a href="${url}">${escapeHtml(label)}</a>`;
}

/** Country (or package name) plus data and validity, shared with top-up notices. */
export function esimPlanSummary(input: {
  locale: WelcomeLocale;
  packageName: string;
  countryCode: string | null;
  dataAmountMb: number | null;
  validityDays: number;
}): { title: string; planLine: string } {
  const title =
    input.countryCode && !input.countryCode.includes(",")
      ? countryDisplayName(input.countryCode, input.locale)
      : input.packageName;

  const data = isFupPackageName(input.packageName)
    ? COPY[input.locale].unlimited
    : formatDataAmount(input.dataAmountMb);
  const days = formatDays(input.validityDays, input.locale);
  return { title, planLine: data ? `${data} · ${days}` : days };
}

export function esimDeliveryMessage(input: {
  preferredLanguage?: string | null;
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

  const text = [
    copy.ready,
    copy.thanks,
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
    "",
    copy.useInstallButtons,
    "",
    guideLink(copy.installGuide, copy.installGuideUrl),
    guideLink(copy.saveDataGuide, copy.saveDataGuideUrl),
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

  const hasQr =
    typeof order.esimQrUrl === "string" && order.esimQrUrl.length > 0;
  const message = esimDeliveryMessage({
    preferredLanguage: user.preferredLanguage,
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
      disableLinkPreview: true,
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: "telegram", reason: "esim_delivery_failed" },
      extra: { orderId: order.id.toString() },
    });
  }
}
