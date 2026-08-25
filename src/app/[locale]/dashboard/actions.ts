"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardSession } from "~/server/dashboard/access";
import { setSalesActive } from "~/server/sales";

export async function setSalesActiveAction(active: boolean) {
  await requireDashboardSession();
  await setSalesActive(active);
  revalidatePath("/dashboard");
}
