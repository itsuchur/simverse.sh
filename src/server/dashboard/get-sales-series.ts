import "server-only";

import { db } from "~/server/db";
import { paymentStatus } from "~/lib/order-status";
import {
  aggregateSalesSeries,
  salesWindow,
  type SalesPoint,
  type SalesRange,
} from "~/server/dashboard/sales-series";

export async function getSalesSeries(
  range: SalesRange,
  now: Date = new Date(),
): Promise<SalesPoint[]> {
  const { start } = salesWindow(range, now);
  const orders = await db.order.findMany({
    where: {
      paymentStatus: paymentStatus.paid,
      paidAt: { gte: start },
    },
    select: {
      priceAmount: true,
      currency: true,
      paymentProvider: true,
      paidAt: true,
    },
  });

  return aggregateSalesSeries(orders, range, now);
}
