import {
  checkoutRequestSchema,
  invoiceResponse,
} from "~/server/orders/checkout";
import * as Sentry from "@sentry/nextjs";

import { auth } from "~/server/better-auth";
import { clientIpFromHeaders } from "~/server/http/client-ip";
import { getCartSnapshot } from "~/server/cart";
import { TRYBIT_PAYMENT_PROVIDER } from "~/lib/order-status";
import {
  createPendingInvoice,
  findOrCreatePendingOrder,
} from "~/server/orders/draft";
import {
  createTrybitInvoice,
  trybitConfigured,
} from "~/server/payments/trybit";
import { checkBalance } from "~/server/suppliers/esimaccess/balance-check";
import { isSalesActive } from "~/server/sales";
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
  if (!(await isSalesActive())) {
    return forbidden();
  }

  if (!trybitConfigured()) {
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

  const countryCode = plan.country.includes(",") ? null : plan.country || null;

  const order = await findOrCreatePendingOrder({
    userId: session.user.id,
    resellerPlanId: plan.packageCode,
    packageName: plan.name,
    countryCode,
    dataAmountMb: Math.round(plan.data_gb * 1024),
    validityDays: plan.validity_days,
    priceAmount: BigInt(cents),
    currency: "USD",
    costAmount: BigInt(Math.round(plan.cost)),
    costCurrency: "USD",
    paymentProvider: TRYBIT_PAYMENT_PROVIDER,
    buyerIp: clientIpFromHeaders(request.headers),
    cartRevision,
  });
  if (order.paymentInvoiceUrl) {
    return invoiceResponse(order.orderUuid, order.paymentInvoiceUrl);
  }

  try {
    const invoiceUrl = await createPendingInvoice(order.id, async () => {
      const invoice = await createTrybitInvoice({
        amount: cents / 100,
        orderId: order.orderUuid,
      });
      return invoice.link;
    });
    return invoiceResponse(order.orderUuid, invoiceUrl);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: "trybit", reason: "invoice_failed" },
      extra: { orderUuid: order.orderUuid },
    });
    return unavailable();
  }
}
