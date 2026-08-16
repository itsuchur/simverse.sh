import type { ReactNode } from "react";

import { AuthGate } from "./_components/auth-gate";
import { FingerprintCollector } from "./_components/fingerprint-collector";
import { MiniAppChrome } from "./_components/mini-app-chrome";
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
    <MiniAppChrome showNav={Boolean(session)}>
      {session ? children : <AuthGate />}
      {session && !session.user.fingerprint ? <FingerprintCollector /> : null}
    </MiniAppChrome>
  );
}
