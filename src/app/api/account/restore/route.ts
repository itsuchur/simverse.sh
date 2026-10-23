import { getAuth } from "~/server/better-auth";
import { db } from "~/server/db";
import { limitMiniappRequest } from "~/server/http/rate-limit";

/**
 * Clears the soft-delete flags after a previously deleted user re-accepts
 * the consent screen and signs back in, recovering their account data.
 */
export async function POST(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await limitMiniappRequest(session.user.id, "account");
  if (limited) return limited;

  await db.user.updateMany({
    where: { id: session.user.id, isDeleted: true },
    data: { isDeleted: false, deletedAt: null },
  });

  return new Response(null, { status: 204 });
}
