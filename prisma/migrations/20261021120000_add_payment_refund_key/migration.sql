ALTER TABLE "orders"
ADD COLUMN "payment_refund_key" UUID NOT NULL DEFAULT gen_random_uuid();
