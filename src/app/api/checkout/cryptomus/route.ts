import * as Sentry from "@sentry/nextjs";

import { auth } from "~/server/better-auth";
import { getCartPlan } from "~/server/cart";
import {
  CRYPTOMUS_PAYMENT_PROVIDER,
  orderStatus,
  paymentStatus,
} from "~/lib/order-status";
import { db } from "~/server/db";
import { env } from "~/env";
import {
  createOrRefreshCryptomusInvoice,
  cryptomusConfigured,
} from "~/server/payments/cryptomus";
import { checkBalance } from "~/server/suppliers/esimaccess/balance-check";
import { forbidden, isUserBanned } from "~/server/users/purchase-access";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function unavailable() {
  return Response.json({ error: "unavailable" }, { status: 503 });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return unauthorized();
  }

  const telegramId = session.user.telegramId;
  if (typeof telegramId !== "string" || telegramId.length === 0) {
    return unauthorized();
  }
  if (await isUserBanned(session.user.id)) {
    return forbidden();
  }

  if (!cryptomusConfigured()) {
    return unavailable();
  }

  const plan = await getCartPlan(telegramId);
  if (!plan) {
    return Response.json({ error: "empty" }, { status: 404 });
  }

  const cents = Math.round(plan.price * 100);
  if (!Number.isFinite(cents) || cents < 1) {
    return unavailable();
  }

  try {
    const balance = await checkBalance();
    if (balance < plan.cost * plan.qty) {
      Sentry.captureMessage("Supplier balance insufficient for checkout", {
        level: "fatal",
        tags: { component: "cart", reason: "insufficient_balance" },
        extra: { packageCode: plan.packageCode, cost: plan.cost },
      });
      return unavailable();
    }
  } catch (error) {
    Sentry.captureException(error, {
      level: "fatal",
      tags: { component: "cart", reason: "balance_check_failed" },
    });
    return unavailable();
  }

  const countryCode = plan.country.includes(",")
    ? null
    : plan.country || null;

  const priceAmount = BigInt(cents);
  const existing = await db.order.findFirst({
    where: {
      userId: session.user.id,
      paymentProvider: CRYPTOMUS_PAYMENT_PROVIDER,
      paymentStatus: paymentStatus.pending,
      status: orderStatus.created,
      resellerPlanId: plan.packageCode,
      priceAmount,
    },
    orderBy: { createdAt: "desc" },
  });

  const order =
    existing ??
    (await db.order.create({
      data: {
        userId: session.user.id,
        resellerCode: "esimaccess",
        resellerPlanId: plan.packageCode,
        packageName: plan.name,
        countryCode,
        dataAmountMb: Math.round(plan.data_gb * 1024),
        validityDays: plan.validity_days,
        priceAmount,
        currency: "USD",
        costAmount: BigInt(Math.round(plan.cost)),
        costCurrency: "USD",
        paymentProvider: CRYPTOMUS_PAYMENT_PROVIDER,
        paymentStatus: paymentStatus.pending,
        status: orderStatus.created,
      },
    }));

  const origin = env.BETTER_AUTH_URL.replace(/\/$/, "");

  try {
    const invoice = await createOrRefreshCryptomusInvoice({
      amount: (cents / 100).toFixed(2),
      orderId: order.orderUuid,
      urlCallback: `${origin}/api/webhooks/payments/cryptomus`,
      urlSuccess: `${origin}/app/myesim`,
      urlReturn: `${origin}/app/checkout`,
    });
    return Response.json({ invoiceUrl: invoice.url });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: "cryptomus", reason: "invoice_failed" },
      extra: { orderUuid: order.orderUuid },
    });
    await db.order.update({
      where: { id: order.id },
      data: {
        status: orderStatus.failed,
        paymentStatus: paymentStatus.failed,
        failureReason: "invoice_failed",
      },
    });
    return unavailable();
  }
}
