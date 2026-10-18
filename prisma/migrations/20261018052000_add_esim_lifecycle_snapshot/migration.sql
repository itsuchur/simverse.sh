-- AlterTable
ALTER TABLE "orders" ADD COLUMN "first_activated_at" TIMESTAMPTZ(6),
ADD COLUMN "data_total_bytes" BIGINT,
ADD COLUMN "data_used_bytes" BIGINT,
ADD COLUMN "expires_at" TIMESTAMPTZ(6),
ADD COLUMN "usage_synced_at" TIMESTAMPTZ(6),
ADD COLUMN "webhook_history_applied_at" TIMESTAMPTZ(6),
ADD COLUMN "activation_checked_at" TIMESTAMPTZ(6);

-- The payload GIN index was dropped. Look up retained eSIM Access webhooks
-- by ICCID or provider order number without scanning the table on each visit.
CREATE INDEX "idx_webhook_logs_esimaccess_iccid"
ON "webhook_logs" ((payload #>> '{content,iccid}'))
WHERE "source" = 'esimaccess';

CREATE INDEX "idx_webhook_logs_esimaccess_order_no"
ON "webhook_logs" ((payload #>> '{content,orderNo}'))
WHERE "source" = 'esimaccess';
