import * as Sentry from "@sentry/nextjs";

import { auth } from "~/server/better-auth";
import { getCartPlan } from "~/server/cart";
import {
  orderStatus,
  paymentStatus,
  STARS_PAYMENT_PROVIDER,
} from "~/lib/order-status";
import { db } from "~/server/db";
import { checkBalance } from "~/server/suppliers/esimaccess/balance-check";
import { createInvoiceLink } from "~/server/telegram/bot-api";

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

  const plan = await getCartPlan(telegramId);
  if (!plan) {
    return Response.json({ error: "empty" }, { status: 404 });
  }

  const stars = Math.round(plan.price_stars);
  if (!Number.isFinite(stars) || stars < 1) {
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

  const priceAmount = BigInt(stars);
  const existing = await db.order.findFirst({
    where: {
      userId: session.user.id,
      paymentProvider: STARS_PAYMENT_PROVIDER,
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
        currency: "XTR",
        costAmount: BigInt(Math.round(plan.cost)),
        costCurrency: "USD",
        paymentProvider: STARS_PAYMENT_PROVIDER,
        paymentStatus: paymentStatus.pending,
        status: orderStatus.created,
      },
    }));

  try {
    const invoiceUrl = await createInvoiceLink({
      title: plan.name,
      description: `${plan.name} · ${plan.validity_days}d`,
      payload: order.orderUuid,
      amountStars: stars,
      label: plan.name,
    });
    return Response.json({ invoiceUrl });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: "telegram", reason: "invoice_failed" },
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
