"use client";

import { type ReactNode, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

export type OrderRecord = {
  id: string;
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
  priceAmount: string;
  currency: string;
  costAmount: string | null;
  costCurrency: string | null;
  paymentProvider: string;
  paymentChargeId: string | null;
  paymentStatus: string;
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
};

const ORDER_FIELDS: {
  column: string;
  value: (order: OrderRecord) => unknown;
}[] = [
  { column: "id", value: (order) => order.id },
  { column: "order_uuid", value: (order) => order.orderUuid },
  { column: "user_id", value: (order) => order.userId },
  { column: "init_data_hash", value: (order) => order.initDataHash },
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

export function OrderRow({
  order,
  children,
}: {
  order: OrderRecord;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto p-6 text-base sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Order {order.id}</DialogTitle>
            <DialogDescription>
              All columns from the orders table.
            </DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[minmax(10rem,14rem)_1fr] gap-x-6 gap-y-3">
            {ORDER_FIELDS.map(({ column, value }) => {
              const formatted = formatValue(value(order));
              const multiline = formatted.includes("\n");
              return (
                <div key={column} className="contents">
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
    </>
  );
}
