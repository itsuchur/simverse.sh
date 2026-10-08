import "server-only";

import { miniappPublicUrl } from "~/lib/miniapp-path";
import {
  welcomeLocale,
  type WelcomeLocale,
  type WelcomeReplyMarkup,
} from "~/server/telegram/start-welcome";
import { miniappOrigin } from "~/server/urls";

export type UsageAlertKind = "DATA_USAGE" | "VALIDITY_USAGE";

/** Format supplier byte volumes the same way as catalog UI. */
export function formatUsageBytes(bytes: number): string {
  const gib = bytes / 1024 ** 3;
  if (gib >= 1) {
    return Number.isInteger(gib) ? `${gib} GB` : `${gib.toFixed(1)} GB`;
  }
  const mib = bytes / 1024 ** 2;
  return `${Math.round(mib)} MB`;
}

const COPY: Record<
  WelcomeLocale,
  {
    data: (packageName: string, remainLabel: string | null) => string;
    validity: (packageName: string) => string;
    button: string;
  }
> = {
  en: {
    data: (packageName, remainLabel) =>
      [
        remainLabel
          ? `Your eSIM "${packageName}" is running low on data — about ${remainLabel} left.`
          : `Your eSIM "${packageName}" is running low on data.`,
        "",
        "Usage updates can lag by a few hours.",
        "",
        "Open My eSIMs if you need another plan.",
      ].join("\n"),
    validity: (packageName) =>
      [
        `Your eSIM "${packageName}" has about 1 day of validity left.`,
        "",
        "Open My eSIMs if you need another plan.",
      ].join("\n"),
    button: "My eSIMs",
  },
  ru: {
    data: (packageName, remainLabel) =>
      [
        remainLabel
          ? `На вашей eSIM «${packageName}» заканчивается интернет — осталось около ${remainLabel}.`
          : `На вашей eSIM «${packageName}» заканчивается интернет.`,
        "",
        "Данные об использовании могут обновляться с задержкой в несколько часов.",
        "",
        "Откройте «Мои eSIM», если нужен ещё один тариф.",
      ].join("\n"),
    validity: (packageName) =>
      [
        `У вашей eSIM «${packageName}» осталось около 1 дня действия.`,
        "",
        "Откройте «Мои eSIM», если нужен ещё один тариф.",
      ].join("\n"),
    button: "Мои eSIM",
  },
};

export function usageAlertMessage(input: {
  kind: UsageAlertKind;
  languageCode?: string | null;
  packageName: string;
  remainBytes?: number | null;
}): {
  text: string;
  replyMarkup: WelcomeReplyMarkup;
} {
  const locale = welcomeLocale(input.languageCode);
  const copy = COPY[locale];
  const remainLabel =
    input.kind === "DATA_USAGE" &&
    typeof input.remainBytes === "number" &&
    Number.isFinite(input.remainBytes) &&
    input.remainBytes >= 0
      ? formatUsageBytes(input.remainBytes)
      : null;

  const text =
    input.kind === "DATA_USAGE"
      ? copy.data(input.packageName, remainLabel)
      : copy.validity(input.packageName);

  return {
    text,
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: copy.button,
            web_app: {
              url: miniappPublicUrl(miniappOrigin(), "/myesim"),
            },
          },
        ],
      ],
    },
  };
}
