import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { getAuth } from "~/server/better-auth";
import { limitMiniappRequest } from "~/server/http/rate-limit";
import {
  cartPlanForPackageCode,
  CatalogIncompleteError,
  clearCart,
  getCartPlan,
  replaceCartPlan,
  UnknownPackageError,
} from "~/server/cart";
import { checkBalance } from "~/server/suppliers/esimaccess/balance-check";
import { forbidden, isUserBanned } from "~/server/users/purchase-access";

const putBodySchema = z.object({
  packageCode: z.string().min(1).max(255),
});

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function unavailable() {
  return Response.json({ error: "unavailable" }, { status: 503 });
}

async function requireTelegramSession(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  const telegramId = session?.user.telegramId;
  if (!session || typeof telegramId !== "string" || telegramId.length === 0) {
    return null;
  }
  return { session, telegramId };
}

export async function PUT(request: Request) {
  const authz = await requireTelegramSession(request);
  if (!authz) {
    return unauthorized();
  }
  const limited = await limitMiniappRequest(authz.session.user.id, "cart");
  if (limited) return limited;

  if (await isUserBanned(authz.session.user.id)) {
    return forbidden();
  }
  const { telegramId } = authz;

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
    const revision = await replaceCartPlan(telegramId, plan);
    return Response.json({ plan, revision });
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
  const authz = await requireTelegramSession(request);
  if (!authz) {
    return unauthorized();
  }
  const { telegramId } = authz;
  const limited = await limitMiniappRequest(authz.session.user.id, "cart");
  if (limited) return limited;

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
  const authz = await requireTelegramSession(request);
  if (!authz) {
    return unauthorized();
  }
  const { telegramId } = authz;
  const limited = await limitMiniappRequest(authz.session.user.id, "cart");
  if (limited) return limited;

  await clearCart(telegramId);
  return new Response(null, { status: 204 });
}
