"use client";

import { type ReactNode, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { formatOrderPrice } from "~/lib/format-order-price";

export type OrderRecord = {
  id: string;
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
  priceAmount: string;
  currency: string;
  costAmount: string | null;
  costCurrency: string | null;
  paymentProvider: string;
  paymentChargeId: string | null;
  paymentStatus: string;
  paymentRefundId: string | null;
  paymentChargebackId: string | null;
  refundedAmount: string | null;
  status: string;
  failureReason: string | null;
  esimIccid: string | null;
  esimStatus: string | null;
  esimSmdpStatus: string | null;
  esimActivationCode: string | null;
  esimQrUrl: string | null;
  esimSmdpAddress: string | null;
  resellerRawResponse: unknown;
  createdAt: string;
  paidAt: string | null;
  issuedAt: string | null;
  updatedAt: string;
  userLabel: string;
  userEmail: string | null;
};

const ORDER_FIELDS: {
  column: string;
  value: (order: OrderRecord) => unknown;
}[] = [
  { column: "id", value: (order) => order.id },
  { column: "order_uuid", value: (order) => order.orderUuid },
  { column: "user_id", value: (order) => order.userId },
  { column: "init_data_hash", value: (order) => order.initDataHash },
  { column: "buyer_ip", value: (order) => order.buyerIp },
  { column: "reseller_code", value: (order) => order.resellerCode },
  { column: "reseller_plan_id", value: (order) => order.resellerPlanId },
  { column: "reseller_order_id", value: (order) => order.resellerOrderId },
  { column: "package_name", value: (order) => order.packageName },
  { column: "country_code", value: (order) => order.countryCode },
  { column: "data_amount_mb", value: (order) => order.dataAmountMb },
  { column: "validity_days", value: (order) => order.validityDays },
  { column: "price_amount", value: (order) => order.priceAmount },
  { column: "currency", value: (order) => order.currency },
  { column: "cost_amount", value: (order) => order.costAmount },
  { column: "cost_currency", value: (order) => order.costCurrency },
  { column: "payment_provider", value: (order) => order.paymentProvider },
  { column: "payment_charge_id", value: (order) => order.paymentChargeId },
  { column: "payment_status", value: (order) => order.paymentStatus },
  { column: "payment_refund_id", value: (order) => order.paymentRefundId },
  {
    column: "payment_chargeback_id",
    value: (order) => order.paymentChargebackId,
  },
  { column: "refunded_amount", value: (order) => order.refundedAmount },
  { column: "status", value: (order) => order.status },
  { column: "failure_reason", value: (order) => order.failureReason },
  { column: "esim_iccid", value: (order) => order.esimIccid },
  { column: "esim_status", value: (order) => order.esimStatus },
  { column: "esim_smdp_status", value: (order) => order.esimSmdpStatus },
  {
    column: "esim_activation_code",
    value: (order) => order.esimActivationCode,
  },
  { column: "esim_qr_url", value: (order) => order.esimQrUrl },
  { column: "esim_smdp_address", value: (order) => order.esimSmdpAddress },
  {
    column: "reseller_raw_response",
    value: (order) => order.resellerRawResponse,
  },
  { column: "created_at", value: (order) => order.createdAt },
  { column: "paid_at", value: (order) => order.paidAt },
  { column: "issued_at", value: (order) => order.issuedAt },
  { column: "updated_at", value: (order) => order.updatedAt },
];

function formatValue(value: unknown) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

function OrderDetailDialog({
  order,
  open,
  onOpenChange,
}: {
  order: OrderRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="data-open:slide-in-from-bottom-4 data-closed:slide-out-to-bottom-4 data-open:zoom-in-100 data-closed:zoom-out-100 top-auto bottom-0 left-1/2 max-h-[min(90dvh,48rem)] w-full max-w-[calc(100%-0rem)] translate-x-[-50%] translate-y-0 gap-4 overflow-y-auto rounded-t-2xl rounded-b-none p-6 text-base sm:top-1/2 sm:bottom-auto sm:max-w-3xl sm:translate-y-[-50%] sm:rounded-xl sm:data-open:slide-in-from-bottom-0 sm:data-closed:slide-out-to-bottom-0 sm:data-open:zoom-in-95 sm:data-closed:zoom-out-95">
        <DialogHeader>
          <DialogTitle className="text-xl">Order {order.id}</DialogTitle>
          <DialogDescription>
            All columns from the orders table.
          </DialogDescription>
        </DialogHeader>
        <dl className="flex flex-col gap-3 sm:grid sm:grid-cols-[minmax(10rem,14rem)_1fr] sm:gap-x-6 sm:gap-y-3">
          {ORDER_FIELDS.map(({ column, value }) => {
            const formatted = formatValue(value(order));
            const multiline = formatted.includes("\n");
            return (
              <div key={column} className="space-y-1 sm:contents">
                <dt className="text-muted-foreground font-mono text-sm leading-6">
                  {column}
                </dt>
                <dd className="min-w-0 leading-6 break-all">
                  {multiline ? (
                    <pre className="bg-muted/40 max-h-64 overflow-auto rounded-lg p-3 font-mono text-sm whitespace-pre-wrap">
                      {formatted}
                    </pre>
                  ) : (
                    <span className="font-mono text-sm">{formatted}</span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </DialogContent>
    </Dialog>
  );
}

function useOrderDialog(order: OrderRecord) {
  const [open, setOpen] = useState(false);
  return {
    open,
    setOpen,
    dialog: (
      <OrderDetailDialog order={order} open={open} onOpenChange={setOpen} />
    ),
  };
}

export function OrderRow({
  order,
  children,
}: {
  order: OrderRecord;
  children: ReactNode;
}) {
  const { setOpen, dialog } = useOrderDialog(order);

  return (
    <>
      <tr
        role="button"
        tabIndex={0}
        className="hover:bg-muted/50 cursor-pointer"
        onClick={() => {
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {children}
      </tr>
      {dialog}
    </>
  );
}

export function OrderCard({ order }: { order: OrderRecord }) {
  const { setOpen, dialog } = useOrderDialog(order);
  const created = order.createdAt.replace("T", " ").slice(0, 19);
  const price = formatOrderPrice(
    BigInt(order.priceAmount),
    order.currency,
    order.paymentProvider,
  );

  return (
    <>
      <button
        type="button"
        className="ring-foreground/10 hover:bg-muted/40 w-full rounded-xl p-4 text-left ring-1 transition-colors"
        onClick={() => {
          setOpen(true);
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="font-medium">{order.packageName}</div>
            <div className="text-muted-foreground text-sm">
              #{order.id} · {created}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-medium tabular-nums">{price}</div>
            <div className="text-muted-foreground text-sm">{order.status}</div>
          </div>
        </div>
        <div className="text-muted-foreground mt-3 space-y-0.5 text-sm">
          <div className="truncate">{order.userLabel}</div>
          {order.userEmail ? (
            <div className="truncate">{order.userEmail}</div>
          ) : null}
          <div>
            {order.paymentProvider} / {order.paymentStatus}
            {order.countryCode ? ` · ${order.countryCode}` : null}
          </div>
        </div>
      </button>
      {dialog}
    </>
  );
}
