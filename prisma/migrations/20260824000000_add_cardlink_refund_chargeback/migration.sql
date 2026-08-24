-- AlterTable
ALTER TABLE "orders" ADD COLUMN "payment_refund_id" TEXT;
ALTER TABLE "orders" ADD COLUMN "payment_chargeback_id" TEXT;
ALTER TABLE "orders" ADD COLUMN "refunded_amount" BIGINT;
