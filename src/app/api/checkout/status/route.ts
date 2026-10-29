import { z } from "zod";
import { getAuth } from "~/server/better-auth";
import { db } from "~/server/db";
import { limitMiniappRequest } from "~/server/http/rate-limit";

export async function GET(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await limitMiniappRequest(session.user.id, "api");
  if (limited) return limited;
  const parsed = z
    .string()
    .uuid()
    .safeParse(new URL(request.url).searchParams.get("orderUuid"));
  if (!parsed.success)
    return Response.json({ error: "invalid_order" }, { status: 400 });
  const order = await db.order.findFirst({
    where: { orderUuid: parsed.data, userId: session.user.id },
    select: { paymentStatus: true },
  });
  if (!order) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(
    { paymentStatus: order.paymentStatus },
    { headers: { "Cache-Control": "no-store" } },
  );
}
