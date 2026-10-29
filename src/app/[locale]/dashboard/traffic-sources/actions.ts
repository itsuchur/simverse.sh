"use server";

import { revalidatePath } from "next/cache";

import { parseTrafficSourceCode } from "~/lib/acquisition-source";
import { requireDashboardSession } from "~/server/dashboard/access";
import { db, isUniqueConstraintError } from "~/server/db";

export async function addTrafficSourceCode(code: string) {
  await requireDashboardSession();
  const parsed = parseTrafficSourceCode(code);
  if (!parsed) {
    throw new Error("Use src_ followed by 1–60 letters, numbers, _ or -.");
  }
  try {
    await db.trafficSourceCode.create({ data: { code: parsed } });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("That code is already registered.");
    }
    throw error;
  }
  revalidatePath("/dashboard/traffic-sources");
}

export async function removeTrafficSourceCode(code: string) {
  await requireDashboardSession();
  await db.trafficSourceCode.delete({ where: { code } });
  revalidatePath("/dashboard/traffic-sources");
}
