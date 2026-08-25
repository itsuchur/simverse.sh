import { auth } from "~/server/better-auth";
import { db } from "~/server/db";

/**
 * Soft-deletes the signed-in user's account: marks it deleted, records the
 * deletion time, and revokes every session. Data is retained for up to a
 * month so the user can change their mind (restored on next consented
 * sign-in); permanent purging is handled out of band.
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { isDeleted: true, deletedAt: new Date() },
  });

  // Revokes the current session and clears the auth cookie (nextCookies).
  await auth.api.signOut({ headers: request.headers });

  // Revoke any remaining sessions on other devices.
  await db.session.deleteMany({ where: { userId: session.user.id } });

  return new Response(null, { status: 204 });
}
