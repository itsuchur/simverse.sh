import { z } from "zod";
import { formatOrderPrice } from "~/lib/format-order-price";
import {
  PLATEGA_PAYMENT_PROVIDER,
  XHUB_PAYMENT_PROVIDER,
  dashboardOrderStatus,
  paymentStatus,
} from "~/lib/order-status";
import { db } from "~/server/db";
import { requireDashboardSession } from "~/server/dashboard/access";

import { OrderCard, OrderRow, type OrderRecord } from "./order-row";
import { RefundOrderButton } from "./refund-order-button";

function canRefundOrder(order: {
  paymentProvider: string;
  paymentStatus: string;
  paymentChargeId: string | null;
}) {
  return (
    [PLATEGA_PAYMENT_PROVIDER, XHUB_PAYMENT_PROVIDER].includes(
      order.paymentProvider,
    ) &&
    order.paymentStatus === paymentStatus.paid &&
    !!order.paymentChargeId
  );
}

export const dynamic = "force-dynamic";

const ORDER_LIMIT = 200;

function formatUser(user: {
  name: string;
  telegramUsername: string | null;
  telegramId: string | null;
}) {
  if (user.telegramUsername) {
    return `@${user.telegramUsername}`;
  }
  if (user.telegramId) {
    return `${user.name} (${user.telegramId})`;
  }
  return user.name;
}

function toOrderRecord(order: {
  id: bigint;
  orderUuid: string;
  userId: string;
  initDataHash: string | null;
  buyerIp: string | null;
  resellerCode: string;
  resellerPlanId: string;
  resellerOrderId: string | null;
  packageName: string;
  countryCode: string | null;
  dataAmountMb: number | null;
  validityDays: number;
  priceAmount: bigint;
  currency: string;
  costAmount: bigint | null;
  costCurrency: string | null;
  paymentProvider: string;
  paymentChargeId: string | null;
  paymentStatus: string;
  paymentChargebackId: string | null;
  refundedAmount: bigint | null;
  refund: {
    id: string;
    providerRefundId: string | null;
    reason: string;
    status: string;
  } | null;
  status: string;
  failureReason: string | null;
  esimIccid: string | null;
  esimStatus: string | null;
  esimSmdpStatus: string | null;
  esimActivationCode: string | null;
  esimQrUrl: string | null;
  esimSmdpAddress: string | null;
  resellerRawResponse: unknown;
  createdAt: Date;
  paidAt: Date | null;
  issuedAt: Date | null;
  updatedAt: Date;
  user: {
    name: string;
    telegramUsername: string | null;
    telegramId: string | null;
    email: string;
  };
}): OrderRecord {
  return {
    id: order.id.toString(),
    orderUuid: order.orderUuid,
    userId: order.userId,
    initDataHash: order.initDataHash,
    buyerIp: order.buyerIp,
    resellerCode: order.resellerCode,
    resellerPlanId: order.resellerPlanId,
    resellerOrderId: order.resellerOrderId,
    packageName: order.packageName,
    countryCode: order.countryCode,
    dataAmountMb: order.dataAmountMb,
    validityDays: order.validityDays,
    priceAmount: order.priceAmount.toString(),
    currency: order.currency,
    costAmount: order.costAmount?.toString() ?? null,
    costCurrency: order.costCurrency,
    paymentProvider: order.paymentProvider,
    paymentChargeId: order.paymentChargeId,
    paymentStatus: order.paymentStatus,
    paymentChargebackId: order.paymentChargebackId,
    refundedAmount: order.refundedAmount?.toString() ?? null,
    refund: order.refund,
    status: order.status,
    failureReason: order.failureReason,
    esimIccid: order.esimIccid,
    esimStatus: order.esimStatus,
    esimSmdpStatus: order.esimSmdpStatus,
    esimActivationCode: order.esimActivationCode,
    esimQrUrl: order.esimQrUrl,
    esimSmdpAddress: order.esimSmdpAddress,
    resellerRawResponse: order.resellerRawResponse,
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    issuedAt: order.issuedAt?.toISOString() ?? null,
    updatedAt: order.updatedAt.toISOString(),
    userLabel: formatUser(order.user),
    userEmail: order.user.email,
  };
}

export default async function DashboardOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string | string[] }>;
}) {
  await requireDashboardSession();
  const rawOrder = (await searchParams).order;
  const orderUuid = z
    .string()
    .uuid()
    .safeParse(Array.isArray(rawOrder) ? rawOrder[0] : rawOrder);
  const orders = await db.order.findMany({
    where: orderUuid.success ? { orderUuid: orderUuid.data } : {},
    take: ORDER_LIMIT,
    orderBy: { createdAt: "desc" },
    include: {
      refund: {
        select: {
          id: true,
          providerRefundId: true,
          reason: true,
          status: true,
        },
      },
      user: {
        select: {
          name: true,
          telegramUsername: true,
          telegramId: true,
          email: true,
        },
      },
    },
  });

  const records = orders.map(toOrderRecord);

  return (
    <main className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>

      <div className="space-y-3 md:hidden">
        {records.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">
            No orders yet.
          </p>
        ) : (
          records.map((order) => (
            <OrderCard key={order.orderUuid} order={order} />
          ))
        )}
      </div>

      <div className="ring-foreground/10 hidden w-full max-w-full overflow-x-auto rounded-xl ring-1 md:block">
        <table className="w-full min-w-max border-separate border-spacing-0 text-left text-base">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-5 py-3.5 font-medium">ID</th>
              <th className="px-5 py-3.5 font-medium">UUID</th>
              <th className="px-5 py-3.5 font-medium">Created</th>
              <th className="px-5 py-3.5 font-medium">User</th>
              <th className="px-5 py-3.5 font-medium">IP</th>
              <th className="px-5 py-3.5 font-medium">Package</th>
              <th className="px-5 py-3.5 font-medium">Package code</th>
              <th className="px-5 py-3.5 font-medium">Country</th>
              <th className="px-5 py-3.5 font-medium">Price</th>
              <th className="px-5 py-3.5 font-medium">Payment</th>
              <th className="px-5 py-3.5 font-medium">Status</th>
              <th className="px-5 py-3.5 font-medium">ICCID</th>
              <th className="px-5 py-3.5 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td className="text-muted-foreground px-5 py-8" colSpan={13}>
                  No orders yet.
                </td>
              </tr>
            ) : (
              orders.map((order, index) => (
                <OrderRow key={order.orderUuid} order={records[index]!}>
                  <td className="border-border border-t px-5 py-3.5 font-mono whitespace-nowrap">
                    {order.id.toString()}
                  </td>
                  <td className="border-border border-t px-5 py-3.5 font-mono text-sm whitespace-nowrap">
                    {order.orderUuid}
                  </td>
                  <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                    {order.createdAt
                      .toISOString()
                      .replace("T", " ")
                      .slice(0, 19)}
                  </td>
                  <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                    <div>{formatUser(order.user)}</div>
                    <div className="text-muted-foreground text-sm">
                      {order.user.email}
                    </div>
                  </td>
                  <td className="border-border border-t px-5 py-3.5 font-mono text-sm whitespace-nowrap">
                    {order.buyerIp ?? "—"}
                  </td>
                  <td className="border-border min-w-48 border-t px-5 py-3.5 whitespace-nowrap">
                    {order.packageName}
                  </td>
                  <td className="border-border border-t px-5 py-3.5 font-mono text-sm whitespace-nowrap">
                    {order.resellerPlanId}
                  </td>
                  <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                    {order.countryCode ?? "—"}
                  </td>
                  <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                    {formatOrderPrice(
                      order.priceAmount,
                      order.currency,
                      order.paymentProvider,
                    )}
                  </td>
                  <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                    {order.paymentProvider} / {order.paymentStatus}
                  </td>
                  <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                    {dashboardOrderStatus(order)}
                  </td>
                  <td className="border-border border-t px-5 py-3.5 font-mono text-sm whitespace-nowrap">
                    {order.esimIccid ?? "—"}
                  </td>
                  <td className="border-border border-t px-5 py-3.5">
                    {canRefundOrder(order) ? (
                      <RefundOrderButton
                        orderUuid={order.orderUuid}
                        refundReason={order.refund?.reason ?? null}
                      />
                    ) : null}
                  </td>
                </OrderRow>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
