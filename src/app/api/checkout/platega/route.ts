import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import {
  checkoutRequestSchema,
  invoiceResponse,
} from "~/server/orders/checkout";
import { auth } from "~/server/better-auth";
import { getCartSnapshot } from "~/server/cart";
import { clientIpFromHeaders } from "~/server/http/client-ip";
import { PLATEGA_PAYMENT_PROVIDER } from "~/lib/order-status";
import { discountedSbpCents } from "~/lib/platega";
import {
  createPendingInvoice,
  findOrCreatePendingOrder,
} from "~/server/orders/draft";
import {
  createPlategaTransaction,
  plategaConfigured,
} from "~/server/payments/platega";
import { checkBalance } from "~/server/suppliers/esimaccess/balance-check";
import { miniappOrigin } from "~/server/urls";
import { isSalesActive } from "~/server/sales";
import { forbidden, isUserBanned } from "~/server/users/purchase-access";

const plategaCheckoutRequestSchema = checkoutRequestSchema.extend({
  paymentMethod: z.enum(["card", "sbp"]).optional(),
});

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
  if (!(await isSalesActive())) {
    return forbidden();
  }

  if (!plategaConfigured()) {
    return unavailable();
  }

  const body = plategaCheckoutRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!body.success) {
    return Response.json({ error: "invalid_checkout" }, { status: 400 });
  }

  const cart = await getCartSnapshot(telegramId);
  if (!cart) {
    return Response.json({ error: "empty" }, { status: 404 });
  }
  const { plan, revision: cartRevision } = cart;
  if (cartRevision !== body.data.cartRevision) {
    return Response.json({ error: "cart_changed" }, { status: 409 });
  }

  const locale = body.data.locale ?? "en";
  const paymentMethod = body.data.paymentMethod ?? "card";
  if (paymentMethod === "sbp" && locale !== "ru") {
    return Response.json({ error: "invalid_checkout" }, { status: 400 });
  }
  const currency = locale === "ru" ? "RUB" : "USD";
  const major = currency === "RUB" ? plan.price_rub : plan.price;
  const cents =
    paymentMethod === "sbp"
      ? discountedSbpCents(plan.price_rub)
      : Math.round(major * 100);
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

  const countryCode = plan.country.includes(",") ? null : plan.country || null;
  const order = await findOrCreatePendingOrder({
    userId: session.user.id,
    resellerPlanId: plan.packageCode,
    packageName: plan.name,
    countryCode,
    dataAmountMb: Math.round(plan.data_gb * 1024),
    validityDays: plan.validity_days,
    priceAmount: BigInt(cents),
    currency,
    costAmount: BigInt(Math.round(plan.cost)),
    costCurrency: "USD",
    paymentProvider: PLATEGA_PAYMENT_PROVIDER,
    buyerIp: clientIpFromHeaders(request.headers),
    cartRevision,
  });
  if (order.paymentInvoiceUrl) {
    return invoiceResponse(order.orderUuid, order.paymentInvoiceUrl);
  }

  const origin = miniappOrigin();

  try {
    const invoiceUrl = await createPendingInvoice(order.id, async () => {
      const transaction = await createPlategaTransaction({
        amount: cents / 100,
        orderId: order.orderUuid,
        description: `${plan.name} · ${plan.validity_days}d`,
        currency,
        paymentMethod: paymentMethod === "sbp" ? 2 : undefined,
        returnUrl: `${origin}/api/checkout/platega/return?status=success`,
        failedUrl: `${origin}/api/checkout/platega/return?status=fail`,
      });
      return transaction.redirect;
    });
    return invoiceResponse(order.orderUuid, invoiceUrl);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: "platega", reason: "invoice_failed" },
      extra: { orderUuid: order.orderUuid },
    });
    return unavailable();
  }
}
