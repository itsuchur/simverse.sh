export const orderStatus = {
  created: "created",
  paid: "paid",
  ordering: "ordering",
  issued: "issued",
  failed: "failed",
  refundPending: "refund_pending",
  refundRequired: "refund_required",
  refunded: "refunded",
} as const;

export const paymentStatus = {
  pending: "pending",
  paid: "paid",
  failed: "failed",
  refunded: "refunded",
  chargeback: "chargeback",
} as const;

export function dashboardOrderStatus(order: {
  status: string;
  esimStatus: string | null;
}): string {
  if (order.status === orderStatus.issued && order.esimStatus === "CANCEL") {
    return "eSIM cancelled";
  }
  return order.status;
}

export const STARS_PAYMENT_PROVIDER = "telegram_stars";
export const TRYBIT_PAYMENT_PROVIDER = "trybit";
export const CARDLINK_PAYMENT_PROVIDER = "cardlink";
export const CENT_PAYMENT_PROVIDER = "cent";
export const PLATEGA_PAYMENT_PROVIDER = "platega";
export const XHUB_PAYMENT_PROVIDER = "xhub";

export const UNITPAY_PAYMENT_PROVIDER = "unitpay";
