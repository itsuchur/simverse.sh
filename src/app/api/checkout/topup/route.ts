import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { auth } from "~/server/better-auth";
import { clientIpFromHeaders } from "~/server/http/client-ip";
import {
  TRYBIT_PAYMENT_PROVIDER,
  XHUB_PAYMENT_PROVIDER,
} from "~/lib/order-status";
import { invoiceResponse } from "~/server/orders/checkout";
import {
  createPendingInvoice,
  findOrCreatePendingOrder,
} from "~/server/orders/draft";
import { DAY_PASS_PRESETS } from "~/lib/topup-offer";
import { prepareTopupPurchase } from "~/server/orders/topup";
import {
  createTrybitInvoice,
  trybitConfigured,
} from "~/server/payments/trybit";
import { createXhubPayment, xhubConfigured } from "~/server/payments/xhub";
import { checkBalance } from "~/server/suppliers/esimaccess/balance-check";
import { isSalesActive } from "~/server/sales";
import { miniappOrigin } from "~/server/urls";
import { forbidden, isUserBanned } from "~/server/users/purchase-access";

const bodySchema = z.object({
  orderUuid: z.string().uuid(),
  provider: z.enum(["trybit", "xhub"]),
  locale: z.enum(["en", "ru"]).optional(),
  packageCode: z.string().min(1),
  days: z
    .number()
    .int()
    .refine((value): value is (typeof DAY_PASS_PRESETS)[number] =>
      (DAY_PASS_PRESETS as readonly number[]).includes(value),
    )
    .optional(),
});

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function unavailable() {
  return Response.json({ error: "unavailable" }, { status: 503 });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return unauthorized();

  const telegramId = session.user.telegramId;
  if (typeof telegramId !== "string" || telegramId.length === 0) {
    return unauthorized();
  }
  if (await isUserBanned(session.user.id)) return forbidden();
  if (!(await isSalesActive())) return forbidden();

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "invalid_checkout" }, { status: 400 });
  }

  const locale = body.data.locale ?? "en";
  if (body.data.provider === "xhub" && (locale !== "ru" || !xhubConfigured())) {
    return unavailable();
  }
  if (body.data.provider === "trybit" && !trybitConfigured()) {
    return unavailable();
  }

  const purchase = await prepareTopupPurchase({
    userId: session.user.id,
    orderUuid: body.data.orderUuid,
    packageCode: body.data.packageCode,
    days: body.data.days,
  });
  if (purchase === "not_found") {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (purchase === "invalid") {
    return Response.json({ error: "invalid_checkout" }, { status: 400 });
  }
  if (purchase === "unavailable") return unavailable();

  const major =
    body.data.provider === "xhub" ? purchase.priceRub : purchase.priceUsd;
  const cents = Math.round(major * 100);
  if (!Number.isFinite(cents) || cents < 1) return unavailable();

  try {
    const balance = await checkBalance();
    if (balance < purchase.supplierCost) {
      Sentry.captureMessage("Supplier balance insufficient for top-up", {
        level: "fatal",
        tags: { component: "topup", reason: "insufficient_balance" },
        extra: {
          orderUuid: body.data.orderUuid,
          packageCode: purchase.draft.resellerPlanId,
          cost: purchase.supplierCost,
        },
      });
      return unavailable();
    }
  } catch (error) {
    Sentry.captureException(error, {
      level: "fatal",
      tags: { component: "topup", reason: "balance_check_failed" },
    });
    return unavailable();
  }

  const provider =
    body.data.provider === "xhub"
      ? XHUB_PAYMENT_PROVIDER
      : TRYBIT_PAYMENT_PROVIDER;
  const buyerIp = clientIpFromHeaders(request.headers);
  const order = await findOrCreatePendingOrder({
    userId: session.user.id,
    resellerPlanId: purchase.draft.resellerPlanId,
    packageName: purchase.draft.packageName,
    countryCode: purchase.draft.countryCode,
    dataAmountMb: purchase.draft.dataAmountMb,
    validityDays: purchase.draft.validityDays,
    priceAmount: BigInt(cents),
    currency: body.data.provider === "xhub" ? "RUB" : "USD",
    costAmount: BigInt(Math.round(purchase.supplierCost)),
    costCurrency: "USD",
    paymentProvider: provider,
    buyerIp,
    topupOfOrderId: purchase.draft.topupOfOrderId,
    topupPeriodDays: purchase.draft.topupPeriodDays,
  });
  if (order.paymentInvoiceUrl) {
    return invoiceResponse(order.orderUuid, order.paymentInvoiceUrl);
  }

  try {
    const invoiceUrl = await createPendingInvoice(order.id, async () => {
      if (body.data.provider === "xhub") {
        const payment = await createXhubPayment({
          amountRub: cents / 100,
          orderUuid: order.orderUuid,
          paymentMethod: "sbp",
          description: purchase.description,
          successUrl: `${miniappOrigin()}/api/checkout/xhub/return?status=success`,
          clientIp: buyerIp,
        });
        return payment.paymentUrl;
      }
      const invoice = await createTrybitInvoice({
        amount: cents / 100,
        orderId: order.orderUuid,
      });
      return invoice.link;
    });
    return invoiceResponse(order.orderUuid, invoiceUrl);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: body.data.provider, reason: "invoice_failed" },
      extra: { orderUuid: order.orderUuid },
    });
    return unavailable();
  }
}
