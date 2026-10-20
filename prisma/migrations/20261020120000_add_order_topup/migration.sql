ALTER TABLE "orders" ADD COLUMN "topup_of_order_id" BIGINT,
ADD COLUMN "topup_period_days" INTEGER;

ALTER TABLE "orders" ADD CONSTRAINT "orders_topup_of_order_id_fkey"
FOREIGN KEY ("topup_of_order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "idx_orders_topup_of_order_id" ON "orders"("topup_of_order_id");

-- NULL topup_of_order_id values are distinct in a unique index, so a single
-- index that includes that column would stop deduplicating new-plan drafts.
DROP INDEX "uq_pending_draft";

CREATE UNIQUE INDEX "uq_pending_draft" ON "orders" (
  "user_id",
  "payment_provider",
  "reseller_plan_id",
  "price_amount",
  "currency"
)
WHERE "payment_status" = 'pending'
  AND "status" = 'created'
  AND "topup_of_order_id" IS NULL;

CREATE UNIQUE INDEX "uq_pending_topup_draft" ON "orders" (
  "user_id",
  "payment_provider",
  "reseller_plan_id",
  "price_amount",
  "currency",
  "topup_of_order_id"
)
WHERE "payment_status" = 'pending'
  AND "status" = 'created'
  AND "topup_of_order_id" IS NOT NULL
  AND "topup_period_days" IS NULL;

CREATE UNIQUE INDEX "uq_pending_topup_period_draft" ON "orders" (
  "user_id",
  "payment_provider",
  "reseller_plan_id",
  "price_amount",
  "currency",
  "topup_of_order_id",
  "topup_period_days"
)
WHERE "payment_status" = 'pending'
  AND "status" = 'created'
  AND "topup_of_order_id" IS NOT NULL
  AND "topup_period_days" IS NOT NULL;
