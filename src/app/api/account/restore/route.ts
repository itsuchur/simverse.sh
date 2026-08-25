import { auth } from "~/server/better-auth";
import { db } from "~/server/db";

/**
 * Clears the soft-delete flags after a previously deleted user re-accepts
 * the consent screen and signs back in, recovering their account data.
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.user.updateMany({
    where: { id: session.user.id, isDeleted: true },
    data: { isDeleted: false, deletedAt: null },
  });

  return new Response(null, { status: 204 });
}
