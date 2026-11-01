import { z } from "zod";
import { getAuth } from "~/server/better-auth";
import { db } from "~/server/db";
import { limitMiniappRequest } from "~/server/http/rate-limit";

/** Restore only after the signed-in user explicitly confirms. */
export async function POST(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await limitMiniappRequest(session.user.id, "account");
  if (limited) return limited;

  const body = z
    .object({ confirmed: z.literal(true) })
    .safeParse(await request.json().catch(() => null));
  if (!body.success)
    return Response.json({ error: "confirmation_required" }, { status: 400 });

  await db.user.updateMany({
    where: { id: session.user.id, isDeleted: true },
    data: { isDeleted: false, deletedAt: null },
  });

  return new Response(null, { status: 204 });
}
