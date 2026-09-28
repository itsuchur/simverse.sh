import type { ReactNode } from "react";

import { LegalCloseButton } from "./legal-close-button";
import { cn } from "~/lib/utils";

export function FullScreenDocument({
  title,
  children,
  showCloseButton = true,
}: {
  title: string;
  children: ReactNode;
  showCloseButton?: boolean;
}) {
  return (
    <div className="bg-background relative flex h-[var(--tg-viewport-stable-height,100dvh)] max-h-[var(--tg-viewport-stable-height,100dvh)] w-full flex-col overflow-hidden">
      <header
        className={cn(
          "shrink-0 pt-[max(1rem,calc(var(--tg-safe-area-inset-top,env(safe-area-inset-top,0px))+var(--tg-content-safe-area-inset-top,0px)))] pb-3",
          showCloseButton ? "px-14" : "px-4",
        )}
      >
        <h1 className="text-center text-xl leading-snug">{title}</h1>
      </header>
      {showCloseButton ? <LegalCloseButton /> : null}
      <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-4 pb-[max(1.5rem,calc(var(--tg-safe-area-inset-bottom,env(safe-area-inset-bottom,0px))+var(--tg-content-safe-area-inset-bottom,0px)))] [-webkit-overflow-scrolling:touch]">
        <div className="mx-auto w-full max-w-2xl">{children}</div>
      </div>
    </div>
  );
}
