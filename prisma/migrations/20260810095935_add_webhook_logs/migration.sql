-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" BIGSERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "headers" JSONB,
    "payload" JSONB,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_webhook_logs_source" ON "webhook_logs"("source");

-- CreateIndex (GIN for jsonb containment / path queries)
CREATE INDEX "idx_webhook_logs_payload" ON "webhook_logs" USING GIN ("payload");
