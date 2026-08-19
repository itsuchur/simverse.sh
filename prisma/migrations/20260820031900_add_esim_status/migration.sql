-- AlterTable
ALTER TABLE "orders" ADD COLUMN "esim_status" TEXT;

-- CreateIndex
CREATE INDEX "idx_orders_esim_iccid" ON "orders"("esim_iccid");
