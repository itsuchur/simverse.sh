export type InvoiceStatus = "paid" | "cancelled" | "failed" | "pending";

export type EsimInstallPlatform = "ios" | "android" | "unknown";

export function prepareTelegramWebApp() {
  const webApp = window.Telegram?.WebApp;
  webApp?.ready?.();
  webApp?.expand?.();
  webApp?.setHeaderColor?.("#ffffff");
  if (webApp?.isVersionAtLeast?.("8.0") && !webApp.isFullscreen) {
    webApp.requestFullscreen?.();
  }
}

/** Wait until Telegram injects Mini App initData (script may load after first paint). */
export function waitForTelegramInitData(timeoutMs = 4000): Promise<string> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const initData = window.Telegram?.WebApp?.initData;
      if (initData) {
        prepareTelegramWebApp();
        resolve(initData);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        reject(new Error("Telegram initData is not available"));
        return;
      }
      window.setTimeout(tick, 50);
    };
    tick();
  });
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

export function openTelegramLink(url: string) {
  const openLink = window.Telegram?.WebApp?.openTelegramLink;
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
