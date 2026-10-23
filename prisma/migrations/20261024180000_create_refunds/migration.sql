CREATE TABLE "refunds" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" BIGINT NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_payment_id" TEXT,
  "provider_refund_id" TEXT,
  "idempotency_key" UUID NOT NULL DEFAULT gen_random_uuid(),
  "amount" BIGINT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'requested',
  "provider_status" TEXT,
  "reason" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "requested_by_id" TEXT,
  "failure_code" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(6),
  CONSTRAINT "refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refunds_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "refunds_status_valid" CHECK ("status" IN ('requested', 'processing', 'completed', 'failed', 'reversed', 'manual_review')),
  CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "refunds_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Historical request times/initiators were not stored. Preserve the known last
-- update time and label these records as migrated rather than inventing an actor.
-- Most importantly, retain the old UUID for in-flight provider retries.
INSERT INTO "refunds" (
  "order_id", "provider", "provider_payment_id", "provider_refund_id",
  "idempotency_key", "amount", "currency", "status", "reason", "source",
  "failure_code", "created_at", "updated_at", "completed_at"
)
SELECT "id", "payment_provider", "payment_charge_id",
  CASE WHEN "payment_provider" = 'xhub' AND "refund_reason" IS NULL
    AND "payment_refund_id" = "payment_charge_id" THEN NULL ELSE "payment_refund_id" END,
  "payment_refund_key", COALESCE("refunded_amount", "price_amount"), "currency",
  CASE
    WHEN "payment_status" = 'refunded' THEN 'completed'
    WHEN "failure_reason" = 'topup_refund_reversed' THEN 'reversed'
    WHEN "status" = 'refund_pending' THEN 'processing'
    WHEN "failure_reason" IN ('topup_refund_failed', 'topup_refund_rejected', 'topup_refund_cancelled') THEN 'failed'
    ELSE 'manual_review'
  END,
  COALESCE(NULLIF("refund_reason", ''), 'Migrated refund record'), 'legacy',
  "failure_reason", "updated_at", "updated_at",
  CASE WHEN "payment_status" = 'refunded' THEN "updated_at" ELSE NULL END
FROM "orders"
WHERE "refund_reason" IS NOT NULL OR "payment_refund_id" IS NOT NULL
  OR "refunded_amount" IS NOT NULL OR "payment_status" = 'refunded'
  OR "status" IN ('refund_pending', 'refund_required', 'refunded');

UPDATE "orders" SET "status" = 'refunded' WHERE "payment_status" = 'refunded';

CREATE UNIQUE INDEX "uq_refunds_order" ON "refunds"("order_id");
CREATE UNIQUE INDEX "refunds_idempotency_key_key" ON "refunds"("idempotency_key");
CREATE UNIQUE INDEX "uq_refunds_provider_refund" ON "refunds"("provider", "provider_refund_id");
CREATE INDEX "idx_refunds_status_created_at" ON "refunds"("status", "created_at" DESC);
CREATE INDEX "idx_refunds_created_at" ON "refunds"("created_at" DESC);

ALTER TABLE "orders" DROP COLUMN "payment_refund_id",
  DROP COLUMN "payment_refund_key", DROP COLUMN "refund_reason";
