"use client";

import { useEffect, type ReactNode } from "react";

import { AppBottomNav } from "./app-bottom-nav";
import { usePathname } from "~/i18n/navigation";
import { prepareTelegramWebApp } from "~/lib/telegram-webapp";
import { isMiniappCheckoutPath } from "~/lib/miniapp-path";
import { cn } from "~/lib/utils";

export function MiniAppChrome({
  children,
  showNav,
}: {
  children: ReactNode;
  showNav: boolean;
}) {
  const pathname = usePathname();
  const isCheckout = isMiniappCheckoutPath(pathname);
  const navVisible = showNav && !isCheckout;

  useEffect(() => {
    prepareTelegramWebApp();
  }, []);

  return (
    <div className="text-foreground min-h-[var(--tg-viewport-stable-height,100dvh)] bg-white">
      <div
        className={cn(
          "mx-auto flex min-h-[var(--tg-viewport-stable-height,100dvh)] w-full max-w-lg flex-col bg-white px-4 pt-[max(0.75rem,calc(var(--tg-safe-area-inset-top,env(safe-area-inset-top,0px))+var(--tg-content-safe-area-inset-top,0px)))]",
          isCheckout
            ? "pb-[max(1.5rem,calc(var(--tg-safe-area-inset-bottom,env(safe-area-inset-bottom,0px))+var(--tg-content-safe-area-inset-bottom,0px)))]"
            : "pb-[calc(6.25rem+var(--tg-safe-area-inset-bottom,env(safe-area-inset-bottom,0px))+var(--tg-content-safe-area-inset-bottom,0px))]",
        )}
      >
        {children}
      </div>
      {navVisible ? <AppBottomNav /> : null}
    </div>
  );
}
