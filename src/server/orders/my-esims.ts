import "server-only";

import { headers } from "next/headers";
import { after } from "next/server";

import { needsActivationFallback } from "~/lib/esim-lifecycle";
import { paymentStatus } from "~/lib/order-status";
import { db } from "~/server/db";
import { limitMiniappRequest } from "~/server/http/rate-limit";
import { syncEsimLifecycleForUser } from "~/server/orders/esim-lifecycle-sync";
import { syncPendingProfilesForUser } from "~/server/orders/fulfill";
import type { MyEsimOrder } from "~/app/[locale]/app/myesim/myesim-list";

/**
 * The buyer's eSIM orders for the Mini App and website account pages.
 * Schedules a supplier profile sync after the response on real navigations.
 */
export async function loadMyEsims(userId: string) {
  const requestHeaders = await headers();
  const isPrefetch =
    requestHeaders.get("next-router-prefetch") === "1" ||
    requestHeaders.get("next-router-segment-prefetch") === "1";
  if (!isPrefetch) {
    after(async () => {
      if (await limitMiniappRequest(userId, "profile-sync")) return;
      await syncPendingProfilesForUser(userId)
        .then(() => syncEsimLifecycleForUser(userId))
        .catch((error: unknown) => {
          console.error("[myesim] profile sync failed", error);
        });
    });
  }

  const rows = await db.order.findMany({
    where: {
      userId,
      paymentStatus: {
        in: [paymentStatus.paid, paymentStatus.pending],
      },
      topupOfOrderId: null,
    },
    orderBy: { createdAt: "desc" },
  });

  const orders: MyEsimOrder[] = rows.map((row) => ({
    id: row.id.toString(),
    orderUuid: row.orderUuid,
    packageName: row.packageName,
    countryCode: row.countryCode,
    dataAmountMb: row.dataAmountMb,
    validityDays: row.validityDays,
    status: row.status,
    paymentStatus: row.paymentStatus,
    failureReason: row.failureReason,
    esimIccid: row.esimIccid,
    esimStatus: row.esimStatus,
    esimSmdpStatus: row.esimSmdpStatus,
    esimActivationCode: row.esimActivationCode,
    esimQrUrl: row.esimQrUrl,
    esimSmdpAddress: row.esimSmdpAddress,
    firstActivatedAt: row.firstActivatedAt?.toISOString() ?? null,
    dataTotalBytes: row.dataTotalBytes?.toString() ?? null,
    dataUsedBytes: row.dataUsedBytes?.toString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    usageSyncedAt: row.usageSyncedAt?.toISOString() ?? null,
    priceAmount: row.priceAmount.toString(),
    currency: row.currency,
    paymentProvider: row.paymentProvider,
    paidAt: row.paidAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));

  const now = new Date();
  const refreshLifecycle = rows.some(
    (row) =>
      row.resellerCode === "esimaccess" &&
      row.paymentStatus === paymentStatus.paid &&
      (row.esimIccid !== null || row.resellerOrderId !== null) &&
      (row.webhookHistoryAppliedAt === null ||
        needsActivationFallback(row, now)),
  );

  return { orders, refreshLifecycle };
}
