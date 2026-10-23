"use server";

import { revalidatePath } from "next/cache";
import { requireDashboardSession } from "~/server/dashboard/access";
import { setDashboardUserBanned } from "~/server/dashboard/ban-user";

export async function setUserBanned(
  userId: string,
  banned: boolean,
  reason?: string,
) {
  await requireDashboardSession();
  await setDashboardUserBanned(userId, banned, reason);
  revalidatePath("/dashboard/users", "page");
}
