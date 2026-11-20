"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  signInWithTelegramWidget,
  type TelegramWidgetUser,
} from "~/lib/auth-client";

declare global {
  interface Window {
    onSimverseTelegramAuth?: (user: TelegramWidgetUser) => void;
  }
}

/** Telegram Login Widget button. Works only on the domain set with BotFather /setdomain. */
export function TelegramLogin({
  botUsername,
  onSignedIn,
}: {
  botUsername: string;
  onSignedIn: (deleted: boolean) => void;
}) {
  const t = useTranslations("Store");
  const locale = useLocale();
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const target = container.current;
    if (!target) return;

    window.onSimverseTelegramAuth = (user) => {
      setError(false);
      void signInWithTelegramWidget(user).then((result) => {
        if (result.error) {
          console.error("[auth] telegram widget sign-in failed", result.error);
          setError(true);
          return;
        }
        const data = result.data as { user?: { isDeleted?: boolean } } | null;
        onSignedIn(data?.user?.isDeleted === true);
      });
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "10");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-lang", locale);
    script.setAttribute("data-onauth", "onSimverseTelegramAuth(user)");
    target.replaceChildren(script);

    return () => {
      target.replaceChildren();
      delete window.onSimverseTelegramAuth;
    };
  }, [botUsername, locale, onSignedIn]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={container} className="min-h-10" />
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {t("loginFailed")}
        </p>
      ) : null}
    </div>
  );
}
