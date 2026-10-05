export const orderStatus = {
  created: "created",
  paid: "paid",
  ordering: "ordering",
  issued: "issued",
  failed: "failed",
} as const;

export const paymentStatus = {
  pending: "pending",
  paid: "paid",
  failed: "failed",
  refunded: "refunded",
  chargeback: "chargeback",
} as const;

export const STARS_PAYMENT_PROVIDER = "telegram_stars";
export const TRYBIT_PAYMENT_PROVIDER = "trybit";
export const CARDLINK_PAYMENT_PROVIDER = "cardlink";
export const PLATEGA_PAYMENT_PROVIDER = "platega";
export const XHUB_PAYMENT_PROVIDER = "xhub";
