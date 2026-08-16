"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardSession } from "~/server/dashboard/access";
import { isDashboardEmail } from "~/server/dashboard/emails";
import { db } from "~/server/db";

export async function toggleUserBanned(userId: string) {
  await requireDashboardSession();

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, isBanned: true },
  });

  if (!user) {
    throw new Error("User not found");
  }
  if (isDashboardEmail(user.email)) {
    throw new Error("Cannot ban a dashboard account");
  }

  await db.user.update({
    where: { id: userId },
    data: { isBanned: !user.isBanned },
  });

  revalidatePath("/dashboard/users");
}
