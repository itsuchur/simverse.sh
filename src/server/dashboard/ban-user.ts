import "server-only";

import { z } from "zod";

import { isDashboardEmail } from "~/server/dashboard/emails";
import { dashboardReasonSchema } from "~/lib/dashboard-reason";
import { db } from "~/server/db";

export async function setDashboardUserBanned(
  userId: string,
  banned: boolean,
  reason?: string,
) {
  z.boolean().parse(banned);

  const banReason = banned ? dashboardReasonSchema.parse(reason) : undefined;

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
    data: { isBanned: banned, ...(banned ? { banReason } : {}) },
  });
}
