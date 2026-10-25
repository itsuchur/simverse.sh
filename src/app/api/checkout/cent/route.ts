import {
  checkoutRequestSchema,
  invoiceResponse,
} from "~/server/orders/checkout";
import * as Sentry from "@sentry/nextjs";

import { getAuth } from "~/server/better-auth";
import { limitMiniappRequest } from "~/server/http/rate-limit";
import { clientIpFromHeaders } from "~/server/http/client-ip";
import { getCartSnapshot } from "~/server/cart";
import { CENT_PAYMENT_PROVIDER } from "~/lib/order-status";
import {
  createPendingInvoice,
  findOrCreatePendingOrder,
} from "~/server/orders/draft";
import { centConfigured, createCentBill } from "~/server/payments/cent";
import { miniappPublicUrl } from "~/lib/miniapp-path";
import { checkBalance } from "~/server/suppliers/esimaccess/balance-check";
import { miniappDeepLink, miniappOrigin } from "~/server/urls";
import { isSalesActive } from "~/server/sales";
import { forbidden, isUserBanned } from "~/server/users/purchase-access";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function unavailable() {
  return Response.json({ error: "unavailable" }, { status: 503 });
}

export async function POST(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) {
    return unauthorized();
  }

  const telegramId = session.user.telegramId;
  if (typeof telegramId !== "string" || telegramId.length === 0) {
    return unauthorized();
  }
  const limited = await limitMiniappRequest(session.user.id, "checkout");
  if (limited) return limited;

  if (await isUserBanned(session.user.id)) {
    return forbidden();
  }
  if (!(await isSalesActive())) {
    return forbidden();
  }

  if (!centConfigured()) {
    return unavailable();
  }

  const body = checkoutRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!body.success)
    return Response.json({ error: "invalid_checkout" }, { status: 400 });

  const cart = await getCartSnapshot(telegramId);
  if (!cart) {
    return Response.json({ error: "empty" }, { status: 404 });
  }
  const { plan, revision: cartRevision } = cart;
  if (cartRevision !== body.data.cartRevision) {
    return Response.json({ error: "cart_changed" }, { status: 409 });
  }

  const locale = body.data.locale ?? "en";

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
    paymentProvider: CENT_PAYMENT_PROVIDER,
    buyerIp: clientIpFromHeaders(request.headers),
    cartRevision,
  });
  if (order.paymentInvoiceUrl) {
    return invoiceResponse(order.orderUuid, order.paymentInvoiceUrl);
  }

  const origin = miniappOrigin();

  try {
    const invoiceUrl = await createPendingInvoice(order.id, async () => {
      const bill = await createCentBill({
        amount: (cents / 100).toFixed(2),
        orderId: order.orderUuid,
        description: `${plan.name} · ${plan.validity_days}d`,
        name: plan.name.slice(0, 64),
        currency,
        locale,
        successUrl: miniappDeepLink("success"),
        failUrl: miniappDeepLink("fail"),
        returnUrl: miniappPublicUrl(origin, "/checkout"),
      });
      return { url: bill.linkPageUrl };
    });
    return invoiceResponse(order.orderUuid, invoiceUrl);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: "cent", reason: "invoice_failed" },
      extra: { orderUuid: order.orderUuid },
    });
    return unavailable();
  }
}
