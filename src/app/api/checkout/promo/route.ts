import { z } from "zod";

import { readPromoCode } from "~/lib/promo-code";
import { getAuth } from "~/server/better-auth";
import { getCartSnapshot } from "~/server/cart";
import {
  limitMiniappRequest,
  limitPromoAttempt,
} from "~/server/http/rate-limit";
import { isSalesActive } from "~/server/sales";
import {
  PromoError,
  promoErrorResponse,
  quotePromo,
} from "~/server/promos/promo";
import { forbidden, isUserBanned } from "~/server/users/purchase-access";

const previewSchema = z.object({
  cartRevision: z.string().uuid(),
  promoCode: z.string().max(64),
});

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) return unauthorized();

  const telegramId = session.user.telegramId;
  if (typeof telegramId !== "string" || telegramId.length === 0) {
    return unauthorized();
  }
  const limited = await limitMiniappRequest(session.user.id, "checkout");
  if (limited) return limited;

  if (await isUserBanned(session.user.id)) return forbidden();
  if (!(await isSalesActive())) return forbidden();

  const body = previewSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "invalid_checkout" }, { status: 400 });
  }
  const promoCode = readPromoCode(body.data.promoCode);
  if (!promoCode) {
    return Response.json({ error: "invalid_code" }, { status: 400 });
  }

  const cart = await getCartSnapshot(telegramId);
  if (!cart) return Response.json({ error: "empty" }, { status: 404 });
  if (cart.revision !== body.data.cartRevision) {
    return Response.json({ error: "cart_changed" }, { status: 409 });
  }

  const promoLimited = await limitPromoAttempt(session.user.id);
  if (promoLimited) return promoLimited;

  try {
    const quote = await quotePromo({
      code: promoCode,
      userId: session.user.id,
      priceRub: cart.plan.price_rub,
      priceUsd: cart.plan.price,
    });
    return Response.json(quote);
  } catch (error) {
    if (error instanceof PromoError) return promoErrorResponse(error);
    throw error;
  }
}
