import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { CheckoutScreen } from "~/components/store/checkout-screen";
import { env } from "~/env";
import {
  catalogNumberFormatOptions,
  catalogPriceAmount,
} from "~/lib/catalog-price";
import { findCatalogPackage, formatVolume } from "~/lib/public-catalog";
import {
  getSession,
  hasDeletedAccountSession,
} from "~/server/better-auth/server";
import { getStoreCatalog } from "~/server/suppliers/esimaccess/packages";

import { CartLoader } from "../_components/cart-loader";
import { PurchaseNotes } from "../_components/purchase-notes";
import { WebAuthGate } from "../_components/web-auth-gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function firstParam(value: string | string[] | undefined) {
  const first = Array.isArray(value) ? value[0] : value;
  return first && first.length <= 255 ? first : undefined;
}

async function SelectedPlan({ packageCode }: { packageCode: string }) {
  const locale = await getLocale();
  const pkg = findCatalogPackage(await getStoreCatalog(locale), packageCode);
  if (!pkg) return null;
  const t = await getTranslations("Store");
  const tCatalog = await getTranslations("Catalog");
  const format = await getFormatter();
  const amount = catalogPriceAmount(pkg, locale);
  const name = locale === "ru" && pkg.nameRu ? pkg.nameRu : pkg.name;

  return (
    <section className="border-border mx-auto w-full max-w-md space-y-1 rounded-xl border p-4">
      <p className="text-muted-foreground text-sm">{t("selectedPlan")}</p>
      <p className="font-semibold">{name}</p>
      <p>
        {formatVolume(pkg.volume)} ·{" "}
        {tCatalog("duration.day", { count: pkg.duration })}
        {amount === undefined
          ? null
          : ` · ${format.number(amount, catalogNumberFormatOptions(locale))}`}
      </p>
    </section>
  );
}

export default async function WebCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{
    package?: string | string[];
    payment?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const packageCode = firstParam(params.package);
  const paymentFailed = firstParam(params.payment) === "failed";
  const t = await getTranslations("Store");

  const session = await getSession();
  if (!session) {
    const deletedAccount = await hasDeletedAccountSession();
    return (
      <main className="flex flex-1 flex-col justify-center gap-6 py-10">
        {packageCode ? <SelectedPlan packageCode={packageCode} /> : null}
        <WebAuthGate
          key={String(deletedAccount)}
          botUsername={env.TELEGRAM_BOT_USERNAME}
          deletedAccount={deletedAccount}
        />
      </main>
    );
  }

  if (packageCode) {
    return <CartLoader packageCode={packageCode} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6">
      {paymentFailed ? (
        <p
          role="alert"
          className="border-destructive/40 text-destructive rounded-xl border p-4"
        >
          {t("paymentFailed")}
        </p>
      ) : null}
      <CheckoutScreen
        session={session}
        channel="web"
        catalogHref="/esim"
        myEsimsHref="/account"
      />
      <PurchaseNotes />
    </div>
  );
}
