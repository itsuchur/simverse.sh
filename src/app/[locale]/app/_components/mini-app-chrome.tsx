"use client";

import type { ReactNode } from "react";

import { AppBottomNav } from "./app-bottom-nav";
import { usePathname } from "~/i18n/navigation";
import { cn } from "~/lib/utils";

export function MiniAppChrome({
  children,
  showNav,
}: {
  children: ReactNode;
  showNav: boolean;
}) {
  const pathname = usePathname();
  const isCheckout = pathname.startsWith("/app/checkout");
  const navVisible = showNav && !isCheckout;

  return (
    <div className="text-foreground min-h-dvh bg-white">
      <div
        className={cn(
          "mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-white px-4 pt-[max(0.75rem,env(safe-area-inset-top))]",
          isCheckout
            ? "pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            : "pb-[calc(6.25rem+env(safe-area-inset-bottom))]",
        )}
      >
        {children}
      </div>
      {navVisible ? <AppBottomNav /> : null}
    </div>
  );
}
