import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { MyEsimList } from "~/app/[locale]/app/myesim/myesim-list";
import { env } from "~/env";
import {
  getSession,
  hasDeletedAccountSession,
} from "~/server/better-auth/server";
import { loadMyEsims } from "~/server/orders/my-esims";

import { SignOutButton, WebAuthGate } from "../_components/web-auth-gate";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Store");
  return {
    title: t("accountMetaTitle"),
    robots: { index: false, follow: false },
  };
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string | string[] }>;
}) {
  const { payment } = await searchParams;
  const t = await getTranslations("Store");

  const session = await getSession();
  if (!session) {
    const deletedAccount = await hasDeletedAccountSession();
    return (
      <main className="flex flex-1 flex-col justify-center py-10">
        <WebAuthGate
          key={String(deletedAccount)}
          botUsername={env.TELEGRAM_BOT_USERNAME}
          deletedAccount={deletedAccount}
        />
      </main>
    );
  }

  const { orders, refreshLifecycle } = await loadMyEsims(session.user.id);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("accountTitle")}
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">
            {t("signedInAs", { name: session.user.name })}
          </span>
          <SignOutButton label={t("signOut")} />
        </div>
      </div>
      {payment === "success" ? (
        <p role="status" className="rounded-xl border p-4">
          {t("paymentSuccess")}
        </p>
      ) : null}
      <MyEsimList orders={orders} refreshLifecycle={refreshLifecycle} />
    </main>
  );
}
