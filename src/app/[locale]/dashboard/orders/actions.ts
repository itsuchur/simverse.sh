"use server";

import { revalidatePath } from "next/cache";

import {
  PLATEGA_PAYMENT_PROVIDER,
  paymentStatus,
} from "~/lib/order-status";
import { requireDashboardSession } from "~/server/dashboard/access";
import { db } from "~/server/db";
import { markPlategaRefunded } from "~/server/orders/fulfill";
import {
  cancelPlategaTransaction,
  checkPlategaCancelSupported,
} from "~/server/payments/platega";
import {
  cancelEsimAccessProfile,
  isUnusedEsimAccessProfile,
  queryEsimAccessProfiles,
} from "~/server/suppliers/esimaccess/order";

export async function refundPlategaOrder(orderUuid: string) {
  await requireDashboardSession();

  const order = await db.order.findUnique({
    where: { orderUuid },
    select: {
      orderUuid: true,
      paymentProvider: true,
      paymentStatus: true,
      paymentChargeId: true,
      priceAmount: true,
      resellerOrderId: true,
      esimIccid: true,
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }
  if (order.paymentProvider !== PLATEGA_PAYMENT_PROVIDER) {
    throw new Error("Order was not paid through Platega");
  }
  if (order.paymentStatus !== paymentStatus.paid) {
    throw new Error("Order is not in a refundable paid state");
  }
  if (!order.paymentChargeId) {
    throw new Error("Order is missing the Platega transaction id");
  }

  if (order.resellerOrderId) {
    const profiles = await queryEsimAccessProfiles(order.resellerOrderId);
    const profile = profiles[0];
    if (profile) {
      const alreadyCancelled =
        profile.esimStatus === "CANCEL" || profile.esimStatus === "REVOKED";
      if (!alreadyCancelled && !isUnusedEsimAccessProfile(profile)) {
        throw new Error("eSIM is activated; refund is not possible");
      }
      if (!alreadyCancelled) {
        if (!profile.esimTranNo) {
          throw new Error(
            "eSIM is missing esimTranNo; cannot cancel with supplier",
          );
        }
        await cancelEsimAccessProfile(profile.esimTranNo);
        await db.order.update({
          where: { orderUuid },
          data: {
            esimStatus: "CANCEL",
            ...(profile.iccid && !order.esimIccid
              ? { esimIccid: profile.iccid }
              : {}),
          },
        });
      }
    }
  }

  const cancelSupported = await checkPlategaCancelSupported(
    order.paymentChargeId,
  );
  if (!cancelSupported.supported) {
    throw new Error(
      cancelSupported.blockReason ?? "Platega cancel is not supported",
    );
  }

  const cancelResult = await cancelPlategaTransaction(order.paymentChargeId);
  if (!cancelResult.accepted || cancelResult.manualControlRequired) {
    throw new Error(cancelResult.message || "Platega refund was not accepted");
  }

  await markPlategaRefunded({
    orderUuid: order.orderUuid,
    transactionId: order.paymentChargeId,
    refundedAmount: order.priceAmount,
  });

  revalidatePath("/dashboard/orders");
}
