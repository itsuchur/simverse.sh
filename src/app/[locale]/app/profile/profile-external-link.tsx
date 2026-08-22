"use client";

import type { ReactNode } from "react";

import { openExternalLink, openTelegramLink } from "~/lib/telegram-webapp";

export function ProfileExternalLink({
  href,
  telegram,
  children,
}: {
  href: string;
  telegram?: boolean;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className="block"
      onClick={(event) => {
        event.preventDefault();
        if (telegram) {
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
