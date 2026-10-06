import { paymentStatus } from "~/lib/order-status";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const ordersRouter = createTRPCRouter({
  /** Paid orders for the profile transaction dialog. */
  history: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.order.findMany({
      where: { userId: ctx.session.user.id, paymentStatus: paymentStatus.paid },
      orderBy: { createdAt: "desc" },
      select: {
        orderUuid: true,
        packageName: true,
        countryCode: true,
        dataAmountMb: true,
        validityDays: true,
        priceAmount: true,
        currency: true,
        paymentProvider: true,
        paidAt: true,
        createdAt: true,
      },
    });

    return rows.map((row) => ({
      orderUuid: row.orderUuid,
      packageName: row.packageName,
      countryCode: row.countryCode,
      dataAmountMb: row.dataAmountMb,
      validityDays: row.validityDays,
      priceAmount: row.priceAmount.toString(),
      currency: row.currency,
      paymentProvider: row.paymentProvider,
      purchasedAt: (row.paidAt ?? row.createdAt).toISOString(),
    }));
  }),
});
