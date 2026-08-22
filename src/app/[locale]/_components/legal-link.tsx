"use client";

import type { ReactNode } from "react";

import { openExternalLink, openTelegramLink } from "~/lib/telegram-webapp";

export function LegalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const isTelegram = href.startsWith("https://t.me/");

  return (
    <a
      href={href}
      className="underline underline-offset-2"
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
