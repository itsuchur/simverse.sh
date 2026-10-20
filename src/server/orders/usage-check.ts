import "server-only";

import { paymentStatus } from "~/lib/order-status";
import { db } from "~/server/db";
import {
  queryEsimAccessProfiles,
  queryEsimAccessUsage,
} from "~/server/suppliers/esimaccess/order";
import { ESIMACCESS_SUPPLIER } from "~/server/suppliers/esimaccess/packages";

export type UsageCheck =
  { dataTotalBytes: string; dataUsedBytes: string } | "not_found";

export async function checkEsimUsage(input: {
  userId: string;
  orderUuid: string;
}): Promise<UsageCheck> {
  const order = await db.order.findUnique({
    where: { orderUuid: input.orderUuid },
  });
  if (!order) return "not_found";
  if (
    order.userId !== input.userId ||
    order.resellerCode !== ESIMACCESS_SUPPLIER ||
    order.paymentStatus !== paymentStatus.paid ||
    !order.resellerOrderId
  ) {
    return "not_found";
  }

  const profiles = await queryEsimAccessProfiles(order.resellerOrderId);
  const profile =
    profiles.find(
      (item) =>
        order.esimIccid !== null &&
        item.iccid === order.esimIccid &&
        item.esimTranNo,
    ) ?? profiles.find((item) => item.esimTranNo);
  if (!profile?.esimTranNo) {
    throw new Error("eSIM Access profile is missing esimTranNo");
  }

  const usage = await queryEsimAccessUsage(profile.esimTranNo);
  await db.order.update({
    where: { id: order.id },
    data: {
      dataTotalBytes: BigInt(usage.totalData),
      dataUsedBytes: BigInt(usage.dataUsage),
      usageSyncedAt: new Date(),
    },
  });

  return {
    dataTotalBytes: usage.totalData.toString(),
    dataUsedBytes: usage.dataUsage.toString(),
  };
}
