import type { ReactNode } from "react";

import { DocumentBackButton } from "./document-back-button";
import { LegalCloseButton } from "./legal-close-button";
import { cn } from "~/lib/utils";

export function FullScreenDocument({
  title,
  children,
  showCloseButton = true,
  showBackButton = false,
}: {
  title: string;
  children: ReactNode;
  showCloseButton?: boolean;
  showBackButton?: boolean;
}) {
  return (
    <div className="bg-background relative flex h-[var(--tg-viewport-stable-height,100dvh)] max-h-[var(--tg-viewport-stable-height,100dvh)] w-full flex-col overflow-hidden">
      {showBackButton ? <DocumentBackButton /> : null}
      {showCloseButton ? <LegalCloseButton /> : null}
      <div
        className={cn(
          "min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-6 pb-[max(1.5rem,calc(var(--tg-safe-area-inset-bottom,env(safe-area-inset-bottom,0px))+var(--tg-content-safe-area-inset-bottom,0px)))] [-webkit-overflow-scrolling:touch]",
          showBackButton
            ? "pt-[max(6rem,calc(var(--tg-safe-area-inset-top,env(safe-area-inset-top,0px))+var(--tg-content-safe-area-inset-top,0px)+3.5rem))]"
            : "pt-[max(3.5rem,calc(var(--tg-safe-area-inset-top,env(safe-area-inset-top,0px))+var(--tg-content-safe-area-inset-top,0px)+1rem))]",
        )}
      >
        <div className="mx-auto flex w-full flex-col items-center">
          <h1 className="w-full max-w-4xl text-center text-5xl font-extrabold tracking-tight text-balance sm:text-6xl md:text-7xl">
            {title}
          </h1>
          <article className="mt-12 w-full max-w-2xl sm:mt-16">
            {children}
          </article>
        </div>
      </div>
    </div>
  );
}
