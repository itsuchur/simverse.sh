export type InvoiceStatus = "paid" | "cancelled" | "failed" | "pending";

type TelegramWebApp = {
  ready?: () => void;
  expand?: () => void;
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
