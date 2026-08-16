import { STARS_PAYMENT_PROVIDER } from "~/lib/order-status";
import { db } from "~/server/db";

import { OrderRow, type OrderRecord } from "./order-row";

export const dynamic = "force-dynamic";

const ORDER_LIMIT = 200;

function formatPrice(amount: bigint, currency: string, provider: string) {
  if (provider === STARS_PAYMENT_PROVIDER) {
    return `${amount.toString()} Stars`;
  }
  const major = Number(amount) / 100;
  return `${major.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

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
  status: string;
  failureReason: string | null;
  esimIccid: string | null;
  esimActivationCode: string | null;
  esimQrUrl: string | null;
  esimSmdpAddress: string | null;
  resellerRawResponse: unknown;
  createdAt: Date;
  paidAt: Date | null;
  issuedAt: Date | null;
  updatedAt: Date;
}): OrderRecord {
  return {
    id: order.id.toString(),
    orderUuid: order.orderUuid,
    userId: order.userId,
    initDataHash: order.initDataHash,
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
    status: order.status,
    failureReason: order.failureReason,
    esimIccid: order.esimIccid,
    esimActivationCode: order.esimActivationCode,
    esimQrUrl: order.esimQrUrl,
    esimSmdpAddress: order.esimSmdpAddress,
    resellerRawResponse: order.resellerRawResponse,
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    issuedAt: order.issuedAt?.toISOString() ?? null,
    updatedAt: order.updatedAt.toISOString(),
  };
}

export default async function DashboardOrdersPage() {
  const orders = await db.order.findMany({
    take: ORDER_LIMIT,
    orderBy: { createdAt: "desc" },
    include: {
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

  return (
    <main className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
      <div className="ring-foreground/10 overflow-x-auto rounded-xl ring-1">
        <table className="w-max min-w-full border-separate border-spacing-0 text-left text-base">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-5 py-3.5 font-medium">ID</th>
              <th className="px-5 py-3.5 font-medium">Created</th>
              <th className="px-5 py-3.5 font-medium">User</th>
              <th className="px-5 py-3.5 font-medium">Package</th>
              <th className="px-5 py-3.5 font-medium">Package code</th>
              <th className="px-5 py-3.5 font-medium">Country</th>
              <th className="px-5 py-3.5 font-medium">Price</th>
              <th className="px-5 py-3.5 font-medium">Payment</th>
              <th className="px-5 py-3.5 font-medium">Status</th>
              <th className="px-5 py-3.5 font-medium">ICCID</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td className="text-muted-foreground px-5 py-8" colSpan={10}>
                  No orders yet.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <OrderRow key={order.orderUuid} order={toOrderRecord(order)}>
                  <td className="border-border border-t px-5 py-3.5 font-mono whitespace-nowrap">
                    {order.id.toString()}
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
                  <td className="border-border min-w-48 border-t px-5 py-3.5">
                    {order.packageName}
                  </td>
                  <td className="border-border border-t px-5 py-3.5 font-mono text-sm whitespace-nowrap">
                    {order.resellerPlanId}
                  </td>
                  <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                    {order.countryCode ?? "—"}
                  </td>
                  <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                    {formatPrice(
                      order.priceAmount,
                      order.currency,
                      order.paymentProvider,
                    )}
                  </td>
                  <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                    {order.paymentProvider} / {order.paymentStatus}
                  </td>
                  <td className="border-border border-t px-5 py-3.5 whitespace-nowrap">
                    {order.status}
                  </td>
                  <td className="border-border border-t px-5 py-3.5 font-mono text-sm whitespace-nowrap">
                    {order.esimIccid ?? "—"}
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
