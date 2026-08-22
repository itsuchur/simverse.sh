WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, payment_provider, reseller_plan_id, price_amount, currency
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM orders
  WHERE payment_status = 'pending' AND status = 'created'
)
UPDATE orders
SET
  status = 'failed',
  payment_status = 'failed',
  failure_reason = 'superseded'
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX "uq_pending_draft" ON "orders" (
  "user_id",
  "payment_provider",
  "reseller_plan_id",
  "price_amount",
  "currency"
)
WHERE "payment_status" = 'pending' AND "status" = 'created';
