import { z } from "zod";

import { getAuth } from "~/server/better-auth";
import { limitMiniappRequest } from "~/server/http/rate-limit";
import { listTopupOffers } from "~/server/orders/topup";
import { forbidden, isUserBanned } from "~/server/users/purchase-access";

const orderUuidSchema = z.string().uuid();

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) return unauthorized();
  const limited = await limitMiniappRequest(session.user.id, "topup");
  if (limited) return limited;
  if (await isUserBanned(session.user.id)) return forbidden();

  const url = new URL(request.url);
  const orderUuid = orderUuidSchema.safeParse(
    url.searchParams.get("orderUuid"),
  );
  if (!orderUuid.success) {
    return Response.json({ error: "invalid_order" }, { status: 400 });
  }

  const offers = await listTopupOffers({
    userId: session.user.id,
    orderUuid: orderUuid.data,
  });
  if (offers === "not_found") {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json(offers);
}
