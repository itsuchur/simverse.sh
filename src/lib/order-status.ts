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
} as const;

export const STARS_PAYMENT_PROVIDER = "telegram_stars";
export const CRYPTOMUS_PAYMENT_PROVIDER = "cryptomus";
export const TRYBIT_PAYMENT_PROVIDER = "trybit";
export const CARDLINK_PAYMENT_PROVIDER = "cardlink";
