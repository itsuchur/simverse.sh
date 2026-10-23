export const refundStatus = {
  requested: "requested",
  processing: "processing",
  completed: "completed",
  failed: "failed",
  reversed: "reversed",
  manualReview: "manual_review",
} as const;

export const REFUND_STATUSES = Object.values(refundStatus);
export type RefundStatus = (typeof REFUND_STATUSES)[number];
