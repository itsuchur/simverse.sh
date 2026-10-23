"use server";

import { revalidatePath } from "next/cache";
import { requireDashboardSession } from "~/server/dashboard/access";
import { refundDashboardOrder } from "~/server/dashboard/refund-order";

export async function refundOrder(orderUuid: string, reason: string) {
  await requireDashboardSession();
  try {
    return await refundDashboardOrder(orderUuid, reason);
  } finally {
    revalidatePath("/dashboard/orders", "page");
    revalidatePath("/dashboard", "page");
  }
}
