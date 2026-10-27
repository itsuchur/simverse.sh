CREATE TABLE "promo_codes" (
  "id" BIGSERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "discount_percent" SMALLINT NOT NULL,
  "max_per_user" INTEGER,
  "max_redemptions" INTEGER,
  "starts_at" TIMESTAMPTZ(6) NOT NULL,
  "ends_at" TIMESTAMPTZ(6),
  "note" TEXT,
  "revoked_at" TIMESTAMPTZ(6),
  "revoked_by_id" TEXT,
  "revoke_reason" TEXT,
  "created_by_id" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "promo_codes_code_charset" CHECK ("code" ~ '^[A-Z0-9]{4,32}$'),
  CONSTRAINT "promo_codes_percent" CHECK ("discount_percent" BETWEEN 1 AND 99),
  CONSTRAINT "promo_codes_max_per_user" CHECK ("max_per_user" IS NULL OR "max_per_user" >= 1),
  CONSTRAINT "promo_codes_max_redemptions" CHECK ("max_redemptions" IS NULL OR "max_redemptions" >= 1),
  CONSTRAINT "promo_codes_window" CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at"),
  CONSTRAINT "promo_codes_revoke_reason" CHECK ("revoked_at" IS NULL OR "revoke_reason" IS NOT NULL)
);

CREATE UNIQUE INDEX "uq_promo_codes_code" ON "promo_codes"("code");

ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_revoked_by_id_fkey"
  FOREIGN KEY ("revoked_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "promo_redemptions" (
  "id" BIGSERIAL NOT NULL,
  "promo_code_id" BIGINT NOT NULL,
  "user_id" TEXT NOT NULL,
  "order_id" BIGINT NOT NULL,
  "once_per_user" BOOLEAN NOT NULL,
  "discount_percent" SMALLINT NOT NULL,
  "list_price_amount" BIGINT NOT NULL,
  "charged_amount" BIGINT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "consumed_at" TIMESTAMPTZ(6),
  "released_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "promo_redemptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "promo_redemptions_amounts" CHECK ("list_price_amount" > "charged_amount" AND "charged_amount" >= 1),
  CONSTRAINT "promo_redemptions_terminal" CHECK ("consumed_at" IS NULL OR "released_at" IS NULL)
);

CREATE UNIQUE INDEX "uq_promo_redemptions_order" ON "promo_redemptions"("order_id");

CREATE UNIQUE INDEX "uq_promo_redemptions_once_per_user"
  ON "promo_redemptions"("promo_code_id", "user_id")
  WHERE "once_per_user" AND "released_at" IS NULL;

CREATE INDEX "idx_promo_redemptions_promo_code_id" ON "promo_redemptions"("promo_code_id");

CREATE INDEX "idx_promo_redemptions_user_id" ON "promo_redemptions"("user_id");

ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_promo_code_id_fkey"
  FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "orders" ADD COLUMN "promo_code_id" BIGINT;

ALTER TABLE "orders" ADD CONSTRAINT "orders_promo_code_id_fkey"
  FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "idx_orders_promo_code_id" ON "orders"("promo_code_id");

-- NULL promo_code_id values are distinct in a unique index, so keep full-price
-- drafts on their own partial index and discounted drafts on another.
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
  AND "topup_of_order_id" IS NULL
  AND "promo_code_id" IS NULL;

CREATE UNIQUE INDEX "uq_pending_promo_draft" ON "orders" (
  "user_id",
  "payment_provider",
  "reseller_plan_id",
  "price_amount",
  "currency",
  "promo_code_id"
)
WHERE "payment_status" = 'pending'
  AND "status" = 'created'
  AND "topup_of_order_id" IS NULL
  AND "promo_code_id" IS NOT NULL;
