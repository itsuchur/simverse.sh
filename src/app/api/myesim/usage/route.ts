import { z } from "zod";

import { auth } from "~/server/better-auth";
import { checkEsimUsage } from "~/server/orders/usage-check";
import { consumeUsageCheckAttempt } from "~/server/orders/usage-check-limit";
import { forbidden, isUserBanned } from "~/server/users/purchase-access";

const bodySchema = z.object({ orderUuid: z.string().uuid() });

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return unauthorized();

  const telegramId = session.user.telegramId;
  if (typeof telegramId !== "string" || telegramId.length === 0) {
    return unauthorized();
  }
  if (await isUserBanned(session.user.id)) return forbidden();

  if ((await consumeUsageCheckAttempt(telegramId)) === "limited") {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "invalid_order" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "invalid_order" }, { status: 400 });
  }

  try {
    const result = await checkEsimUsage({
      userId: session.user.id,
      orderUuid: parsed.data.orderUuid,
    });
    if (result === "not_found") {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    return Response.json(result);
  } catch {
    return Response.json({ error: "usage_unavailable" }, { status: 502 });
  }
}
