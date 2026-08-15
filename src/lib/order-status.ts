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
