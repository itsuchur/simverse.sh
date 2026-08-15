import * as Sentry from "@sentry/nextjs";
import { getLocale, getTranslations } from "next-intl/server";

import { CheckoutView } from "./checkout-view";
import { buttonVariants } from "~/components/ui/button";
import { Link, redirect } from "~/i18n/navigation";
import { getSession } from "~/server/better-auth/server";
import { getCartPlan } from "~/server/cart";
import { checkBalance } from "~/server/suppliers/esimaccess/balance-check";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const locale = await getLocale();
  const telegramId = session.user.telegramId;
  const plan =
    typeof telegramId === "string" && telegramId.length > 0
      ? await getCartPlan(telegramId)
      : null;

  if (!plan) {
    const t = await getTranslations("Checkout");
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-sm">{t("empty")}</p>
        <Link href="/app" className={buttonVariants({ variant: "outline" })}>
          {t("backToCatalog")}
        </Link>
      </main>
    );
  }

  try {
    const balance = await checkBalance();
    if (balance >= plan.cost * plan.qty) {
      return <CheckoutView plan={plan} />;
    }
    Sentry.captureMessage("Supplier balance insufficient for checkout", {
      level: "fatal",
      tags: {
        component: "cart",
        reason: "insufficient_balance",
      },
      extra: {
        packageCode: plan.packageCode,
        cost: plan.cost,
        qty: plan.qty,
      },
    });
  } catch (error) {
    Sentry.captureException(error, {
      level: "fatal",
      tags: {
        component: "cart",
        reason: "balance_check_failed",
      },
    });
  }

  redirect({ href: "/app", locale });
}
