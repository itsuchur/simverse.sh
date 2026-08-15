import type { ReactNode } from "react";

import { AuthGate } from "../app/_components/auth-gate";
import { getSession } from "~/server/better-auth/server";

export default async function CheckoutLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();

  return (
    <div className="text-foreground min-h-dvh bg-white">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-white px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {session ? children : <AuthGate />}
      </div>
    </div>
  );
}
