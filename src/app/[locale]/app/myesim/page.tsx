import { headers } from "next/headers";
import { after } from "next/server";
import { needsActivationFallback } from "~/lib/esim-lifecycle";
import { paymentStatus } from "~/lib/order-status";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { limitMiniappRequest } from "~/server/http/rate-limit";
import { syncEsimLifecycleForUser } from "~/server/orders/esim-lifecycle-sync";
import { syncPendingProfilesForUser } from "~/server/orders/fulfill";

import { MyEsimList, type MyEsimOrder } from "./myesim-list";

export const dynamic = "force-dynamic";

export default async function AppMyESIms() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const requestHeaders = await headers();
  const isPrefetch =
    requestHeaders.get("next-router-prefetch") === "1" ||
    requestHeaders.get("next-router-segment-prefetch") === "1";
  if (!isPrefetch) {
    const userId = session.user.id;
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
      userId: session.user.id,
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

  return (
    <main className="flex flex-1 flex-col py-4">
      <MyEsimList orders={orders} refreshLifecycle={refreshLifecycle} />
    </main>
  );
}
