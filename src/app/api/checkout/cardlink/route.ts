import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { auth } from "~/server/better-auth";
import { getCartPlan } from "~/server/cart";
import {
  CARDLINK_PAYMENT_PROVIDER,
  orderStatus,
  paymentStatus,
} from "~/lib/order-status";
import { db } from "~/server/db";
import { env } from "~/env";
import {
  cardlinkConfigured,
  createCardlinkBill,
} from "~/server/payments/cardlink";
import { checkBalance } from "~/server/suppliers/esimaccess/balance-check";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function unavailable() {
  return Response.json({ error: "unavailable" }, { status: 503 });
}

const bodySchema = z.object({
  locale: z.enum(["en", "ru"]).optional(),
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return unauthorized();
  }

  const telegramId = session.user.telegramId;
  if (typeof telegramId !== "string" || telegramId.length === 0) {
    return unauthorized();
  }

  if (!cardlinkConfigured()) {
    return unavailable();
  }

  const plan = await getCartPlan(telegramId);
  if (!plan) {
    return Response.json({ error: "empty" }, { status: 404 });
  }

  let locale: "en" | "ru" = "en";
  try {
    const json: unknown = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (parsed.success && parsed.data.locale) {
      locale = parsed.data.locale;
    }
  } catch {
    // Empty or non-JSON body; default locale.
  }

  const currency = locale === "ru" ? "RUB" : "USD";
  const major = currency === "RUB" ? plan.price_rub : plan.price;
  const cents = Math.round(major * 100);
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
      paymentProvider: CARDLINK_PAYMENT_PROVIDER,
      paymentStatus: paymentStatus.pending,
      status: orderStatus.created,
      resellerPlanId: plan.packageCode,
      priceAmount,
      currency,
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
        currency,
        costAmount: BigInt(Math.round(plan.cost)),
        costCurrency: "USD",
        paymentProvider: CARDLINK_PAYMENT_PROVIDER,
        paymentStatus: paymentStatus.pending,
        status: orderStatus.created,
      },
    }));

  const origin = env.BETTER_AUTH_URL.replace(/\/$/, "");

  try {
    const bill = await createCardlinkBill({
      amount: (cents / 100).toFixed(2),
      orderId: order.orderUuid,
      description: `${plan.name} · ${plan.validity_days}d`,
      name: plan.name.slice(0, 64),
      currency,
      locale,
      successUrl: `${origin}/api/checkout/cardlink/return?status=success`,
      failUrl: `${origin}/api/checkout/cardlink/return?status=fail`,
      returnUrl: `${origin}/checkout`,
    });
    return Response.json({ invoiceUrl: bill.linkPageUrl });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: "cardlink", reason: "invoice_failed" },
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
