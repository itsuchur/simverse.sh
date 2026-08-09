import type { ReactNode } from "react";

import { TelegramAuth } from "~/app/_components/telegram-auth";
import { AppBottomNav } from "~/app/app/_components/app-bottom-nav";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default function MiniAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-white text-foreground">
      <TelegramAuth />

      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-white px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        {children}
      </div>

      <AppBottomNav />
    </div>
  );
}
