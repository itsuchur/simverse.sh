import "server-only";

import { db } from "~/server/db";

export function forbidden() {
  return Response.json({ error: "forbidden" }, { status: 403 });
}

export async function isUserBanned(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isBanned: true },
  });
  return user?.isBanned === true;
}
