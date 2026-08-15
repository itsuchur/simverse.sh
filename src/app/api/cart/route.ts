import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { auth } from "~/server/better-auth";
import {
  cartPlanForPackageCode,
  CatalogIncompleteError,
  clearCart,
  getCartPlan,
  replaceCartPlan,
  UnknownPackageError,
} from "~/server/cart";
import { checkBalance } from "~/server/suppliers/esimaccess/balance-check";

const putBodySchema = z.object({
  packageCode: z.string().min(1),
});

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function unavailable() {
  return Response.json({ error: "unavailable" }, { status: 503 });
}

async function requireTelegramId(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const telegramId = session?.user.telegramId;
  return typeof telegramId === "string" && telegramId.length > 0
    ? telegramId
    : null;
}

export async function PUT(request: Request) {
  const telegramId = await requireTelegramId(request);
  if (!telegramId) {
    return unauthorized();
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = putBodySchema.safeParse(json);
  if (!body.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const plan = await cartPlanForPackageCode(body.data.packageCode);
    await replaceCartPlan(telegramId, plan);
    return Response.json({ plan });
  } catch (error) {
    if (error instanceof UnknownPackageError) {
      return Response.json({ error: "Unknown package" }, { status: 404 });
    }
    if (error instanceof CatalogIncompleteError) {
      return unavailable();
    }
    throw error;
  }
}

export async function GET(request: Request) {
  const telegramId = await requireTelegramId(request);
  if (!telegramId) {
    return unauthorized();
  }

  const plan = await getCartPlan(telegramId);
  if (!plan) {
    return Response.json({ error: "empty" }, { status: 404 });
  }

  try {
    const balance = await checkBalance();
    if (balance < plan.cost * plan.qty) {
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
      return unavailable();
    }
  } catch (error) {
    Sentry.captureException(error, {
      level: "fatal",
      tags: {
        component: "cart",
        reason: "balance_check_failed",
      },
    });
    return unavailable();
  }

  return Response.json({ plan });
}

export async function DELETE(request: Request) {
  const telegramId = await requireTelegramId(request);
  if (!telegramId) {
    return unauthorized();
  }

  await clearCart(telegramId);
  return new Response(null, { status: 204 });
}
