"use client";

import type { ReactNode } from "react";

import { openExternalLink, openTelegramLink } from "~/lib/telegram-webapp";
import { cn } from "~/lib/utils";

export function LegalLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const isTelegram = href.startsWith("https://t.me/");

  return (
    <a
      href={href}
      className={cn("underline underline-offset-2", className)}
      onClick={(event) => {
        if (href.startsWith("mailto:")) {
          return;
        }

        event.preventDefault();
        if (isTelegram) {
          openTelegramLink(href);
          return;
        }
        openExternalLink(href);
      }}
    >
      {children}
    </a>
  );
}
