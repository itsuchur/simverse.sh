export type InvoiceStatus = "paid" | "cancelled" | "failed" | "pending";

export type EsimInstallPlatform = "ios" | "android" | "unknown";

type TelegramWebApp = {
  ready?: () => void;
  expand?: () => void;
  platform?: string;
  openLink?: (url: string) => void;
  openInvoice: (
    url: string,
    callback?: (status: InvoiceStatus) => void,
  ) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function prepareTelegramWebApp() {
  window.Telegram?.WebApp?.ready?.();
  window.Telegram?.WebApp?.expand?.();
}

function platformFromUserAgent(userAgent: string): EsimInstallPlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "unknown";
}

export function detectEsimInstallPlatform(): EsimInstallPlatform {
  const telegramPlatform = window.Telegram?.WebApp?.platform?.toLowerCase();
  if (telegramPlatform === "ios") return "ios";
  if (telegramPlatform === "android" || telegramPlatform === "android_x") {
    return "android";
  }
  if (telegramPlatform) return "unknown";
  return platformFromUserAgent(navigator.userAgent);
}

export function openExternalLink(url: string) {
  const openLink = window.Telegram?.WebApp?.openLink;
  if (typeof openLink === "function") {
    openLink(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function openTelegramInvoice(url: string): Promise<InvoiceStatus> {
  const webApp = window.Telegram?.WebApp;
  if (typeof webApp?.openInvoice !== "function") {
    return Promise.reject(new Error("Telegram WebApp is not available"));
  }

  return new Promise((resolve) => {
    webApp.openInvoice(url, (status) => {
      resolve(status);
    });
  });
}
