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
      paymentStatus: {
        in: [
          paymentStatus.paid,
          paymentStatus.refunded,
          paymentStatus.chargeback,
        ],
      },
      paidAt: { gte: start, lte: now },
    },
    select: {
      priceAmount: true,
      currency: true,
      paymentProvider: true,
      paidAt: true,
      paymentStatus: true,
      refundedAmount: true,
    },
  });

  return aggregateSalesSeries(orders, range, now);
}
