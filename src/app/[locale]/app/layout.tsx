import type { ReactNode } from "react";

import { AppBottomNav } from "./_components/app-bottom-nav";
import { AuthGate } from "./_components/auth-gate";
import { getSession } from "~/server/better-auth/server";

export default async function MiniAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Gate the mini app behind a session. First-time visitors are signed in
  // automatically by <AuthGate /> using Telegram initData, then the route is
  // refreshed and renders the actual content. Reading the session also makes
  // every /app route dynamic, which the catalog requires anyway.
  const session = await getSession();

  return (
    <div className="text-foreground min-h-dvh bg-white">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-white px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[calc(6.25rem+env(safe-area-inset-bottom))]">
        {session ? children : <AuthGate />}
      </div>

      {session ? <AppBottomNav /> : null}
    </div>
  );
}
