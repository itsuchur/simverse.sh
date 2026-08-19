import { paymentStatus } from "~/lib/order-status";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { syncPendingProfilesForUser } from "~/server/orders/fulfill";

import { MyEsimList, type MyEsimOrder } from "./myesim-list";

export const dynamic = "force-dynamic";

export default async function AppMyESIms() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  await syncPendingProfilesForUser(session.user.id);

  const rows = await db.order.findMany({
    where: {
      userId: session.user.id,
      paymentStatus: paymentStatus.paid,
    },
    orderBy: { createdAt: "desc" },
  });

  const orders: MyEsimOrder[] = rows.map((row) => ({
    orderUuid: row.orderUuid,
    packageName: row.packageName,
    countryCode: row.countryCode,
    dataAmountMb: row.dataAmountMb,
    validityDays: row.validityDays,
    status: row.status,
    failureReason: row.failureReason,
    esimIccid: row.esimIccid,
    esimStatus: row.esimStatus,
    esimSmdpStatus: row.esimSmdpStatus,
    esimActivationCode: row.esimActivationCode,
    esimQrUrl: row.esimQrUrl,
    esimSmdpAddress: row.esimSmdpAddress,
    createdAt: row.createdAt.toISOString(),
  }));

  return (
    <main className="flex flex-1 flex-col py-4">
      <MyEsimList orders={orders} />
    </main>
  );
}
