import "server-only";

import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

import { CheckoutView } from "~/app/[locale]/app/checkout/checkout-view";
import { buttonVariants } from "~/components/ui/button";
import { Link, redirect } from "~/i18n/navigation";
import type { CheckoutChannel } from "~/lib/checkout-channel";
import { detectedCodapayCountry } from "~/lib/codapay-markets";
import type { Session } from "~/server/better-auth/config";
import { getCartSnapshot } from "~/server/cart";
import { db } from "~/server/db";
import { isSalesActive } from "~/server/sales";
import { checkBalance } from "~/server/suppliers/esimaccess/balance-check";
import { extractCoverage } from "~/server/suppliers/esimaccess/coverage";
import { getEsimAccessPackageByCode } from "~/server/suppliers/esimaccess/packages";

function CheckoutNotice({
  message,
  catalogHref,
  backLabel,
}: {
  message: string;
  catalogHref: string;
  backLabel: string;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 py-24 text-center">
      <p className="text-base leading-7">{message}</p>
      <Link
        href={catalogHref}
        className={buttonVariants({
          variant: "outline",
          size: "lg",
          className: "h-11 px-4 text-base",
        })}
      >
        {backLabel}
      </Link>
    </main>
  );
}

/** Cart checkout shared by the Mini App and the website. */
export async function CheckoutScreen({
  session,
  channel,
  catalogHref,
  myEsimsHref,
}: {
  session: Session;
  channel: CheckoutChannel;
  catalogHref: string;
  myEsimsHref: string;
}) {
  const locale = await getLocale();
  const t = await getTranslations("Checkout");

  if (!(await isSalesActive())) {
    return (
      <CheckoutNotice
        message={t("salesClosed")}
        catalogHref={catalogHref}
        backLabel={t("backToCatalog")}
      />
    );
  }

  const cart = await getCartSnapshot(session.user.id);

  const plan = cart?.plan;
  if (!plan || !cart?.revision) {
    return (
      <CheckoutNotice
        message={t("empty")}
        catalogHref={catalogHref}
        backLabel={t("backToCatalog")}
      />
    );
  }

  const existingPayment = await db.order.findFirst({
    where: {
      userId: session.user.id,
      cartRevision: cart.revision,
      paymentInvoiceUrl: { not: null },
      topupOfOrderId: null,
    },
    orderBy: { createdAt: "desc" },
    select: { orderUuid: true, paymentInvoiceUrl: true, paymentStatus: true },
  });
  if (existingPayment?.paymentStatus === "paid") {
    redirect({ href: myEsimsHref, locale });
  }
  const initialPayment = existingPayment?.paymentInvoiceUrl
    ? {
        orderUuid: existingPayment.orderUuid,
        invoiceUrl: existingPayment.paymentInvoiceUrl,
      }
    : null;

  let hasBalance = initialPayment !== null;
  try {
    if (!initialPayment) {
      const balance = await checkBalance();
      hasBalance = balance >= plan.cost * plan.qty;
      if (!hasBalance) {
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
      }
    }
  } catch (error) {
    Sentry.captureException(error, {
      level: "fatal",
      tags: {
        component: "cart",
        reason: "balance_check_failed",
      },
    });
  }

  if (!hasBalance) {
    redirect({ href: catalogHref, locale });
  }

  const catalog = await getEsimAccessPackageByCode(plan.packageCode);
  return (
    <CheckoutView
      key={cart.revision}
      channel={channel}
      catalogHref={catalogHref}
      myEsimsHref={myEsimsHref}
      initialPayment={initialPayment}
      initialBillingCountry={detectedCodapayCountry(await headers())}
      plan={plan}
      cartRevision={cart.revision}
      supportTopUpType={catalog?.pkg.supportTopUpType}
      networkCoverage={extractCoverage(
        catalog?.pkg.locationNetworkList,
        plan.country,
      )}
    />
  );
}
