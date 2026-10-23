"use server";

import { revalidatePath } from "next/cache";
import { requireDashboardSession } from "~/server/dashboard/access";
import { refundDashboardOrder } from "~/server/dashboard/refund-order";

export async function refundOrder(orderUuid: string, reason: string) {
  const session = await requireDashboardSession();
  try {
    return await refundDashboardOrder(orderUuid, reason, session.user.id);
  } finally {
    revalidatePath("/dashboard/orders", "page");
    revalidatePath("/dashboard/refunds", "page");
    revalidatePath("/dashboard", "page");
  }
}
