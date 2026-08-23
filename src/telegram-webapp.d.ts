type TelegramWebApp = {
  ready?: () => void;
  expand?: () => void;
  requestFullscreen?: () => void;
  setHeaderColor?: (color: string) => void;
  isVersionAtLeast?: (version: string) => boolean;
  isFullscreen?: boolean;
  platform?: string;
  openLink?: (url: string) => void;
  openTelegramLink?: (url: string) => void;
  openInvoice: (
    url: string,
    callback?: (status: "paid" | "cancelled" | "failed" | "pending") => void,
  ) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export {};
