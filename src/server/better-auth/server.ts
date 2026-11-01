import { db } from "~/server/db";
import { getAuth } from ".";
import { headers } from "next/headers";
import { cache } from "react";

export const getSession = cache(async () => {
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isDeleted: true },
  });
  return user && !user.isDeleted ? session : null;
});
