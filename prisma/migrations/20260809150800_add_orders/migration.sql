-- CreateTable
CREATE TABLE "orders" (
    "id" BIGSERIAL NOT NULL,
    "order_uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "init_data_hash" TEXT,
    "reseller_code" TEXT NOT NULL,
    "reseller_plan_id" TEXT NOT NULL,
    "reseller_order_id" TEXT,
    "package_name" TEXT NOT NULL,
    "country_code" TEXT,
    "data_amount_mb" INTEGER,
    "validity_days" INTEGER NOT NULL,
    "price_amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "cost_amount" BIGINT,
    "cost_currency" CHAR(3),
    "payment_provider" TEXT NOT NULL,
    "payment_charge_id" TEXT,
    "payment_status" TEXT NOT NULL DEFAULT 'pending',
    "status" TEXT NOT NULL DEFAULT 'created',
    "failure_reason" TEXT,
    "esim_iccid" TEXT,
    "esim_activation_code" TEXT,
    "esim_qr_url" TEXT,
    "esim_smdp_address" TEXT,
    "reseller_raw_response" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "paid_at" TIMESTAMPTZ,
    "issued_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "uq_order_uuid" UNIQUE ("order_uuid"),
    CONSTRAINT "uq_reseller_order" UNIQUE ("reseller_code", "reseller_order_id")
);

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "idx_orders_user_id" ON "orders"("user_id");

-- CreateIndex
CREATE INDEX "idx_orders_status" ON "orders"("status");

-- CreateIndex
CREATE INDEX "idx_orders_reseller_code" ON "orders"("reseller_code");

-- CreateIndex
CREATE INDEX "idx_orders_created_at" ON "orders"("created_at" DESC);

-- CreateIndex (partial unique)
CREATE UNIQUE INDEX "uq_payment_charge" ON "orders"("payment_provider", "payment_charge_id")
WHERE "payment_charge_id" IS NOT NULL;
