import "server-only";

import type { Prisma } from "@prisma/client";
import { XHUB_PAYMENT_PROVIDER } from "~/lib/order-status";
import { fetchBalance } from "~/server/suppliers/esimaccess/balance-check";

export const XHUB_RESERVATION_TTL_MS = 10 * 60_000;

/** Called under the invoice admission lock, before committing its claim. */
export async function assertSupplierCapacity(
  tx: Prisma.TransactionClient,
  orderId: bigint,
) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  if (
    order.resellerCode !== "esimaccess" ||
    order.costCurrency !== "USD" ||
    order.costAmount === null ||
    order.costAmount <= 0n
  ) {
    throw new Error("invalid_supplier_cost");
  }

  // Read liabilities BEFORE balance. A fulfillment completing during the
  // balance request can then only cause conservative double-counting.
  // Unpaid X-Hub orders hold capacity for ten minutes from order creation.
  // Reusing a link or reconciling an order must not extend that window.
  // Paid orders retain capacity until supplier fulfillment, regardless of age.
  const outstanding = await tx.order.findMany({
    where: {
      id: { not: orderId },
      resellerCode: "esimaccess",
      OR: [
        {
          paymentStatus: { in: ["pending", "failed"] },
          AND: [
            {
              OR: [
                { paymentProvider: { not: XHUB_PAYMENT_PROVIDER } },
                {
                  createdAt: {
                    gt: new Date(Date.now() - XHUB_RESERVATION_TTL_MS),
                  },
                },
              ],
            },
          ],
          OR: [
            { paymentInvoiceClaim: { not: null } },
            { paymentInvoiceId: { not: null } },
            { paymentInvoiceUrl: { not: null } },
          ],
        },
        {
          paymentStatus: "paid",
          OR: [
            { topupOfOrderId: null, resellerOrderId: null },
            { topupOfOrderId: { not: null }, status: { not: "issued" } },
          ],
        },
      ],
    },
    select: { costAmount: true, costCurrency: true },
  });
  let required = order.costAmount;
  for (const liability of outstanding) {
    if (
      liability.costCurrency !== "USD" ||
      liability.costAmount === null ||
      liability.costAmount <= 0n
    ) {
      throw new Error("invalid_supplier_cost");
    }
    required += liability.costAmount;
  }
  // Never use the page-view cache for admission, including its in-flight call.
  const balance = BigInt(await fetchBalance());
  if (balance < required) throw new Error("insufficient_supplier_balance");
}
