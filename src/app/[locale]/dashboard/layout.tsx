import type { ReactNode } from "react";

import { env } from "~/env";
import { getSession } from "~/server/better-auth/server";
import { isDashboardEmail } from "~/server/dashboard/emails";

import { DashboardNav } from "./_components/dashboard-nav";
import { DashboardSignIn } from "./_components/dashboard-sign-in";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  const googleConfigured = Boolean(
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
  );

  if (!session || !isDashboardEmail(session.user.email)) {
    return (
      <DashboardSignIn
        hasWrongAccount={Boolean(session)}
        googleConfigured={googleConfigured}
      />
    );
  }

  return (
    <div className="bg-background text-foreground min-h-dvh text-base">
      <DashboardNav />
      <div className="px-8 py-8">{children}</div>
    </div>
  );
}
