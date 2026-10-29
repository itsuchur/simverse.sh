ALTER TABLE "user" DROP CONSTRAINT "user_acquisition_source_check";

ALTER TABLE "user" ADD CONSTRAINT "user_acquisition_source_check"
  CHECK (
    "acquisitionSource" IS NULL
    OR "acquisitionSource" = 'organic'
    OR "acquisitionSource" = 'unknown'
    OR "acquisitionSource" ~ '^src_[A-Za-z0-9_-]{1,60}$'
  );

ALTER TABLE "telegram_start" DROP CONSTRAINT "telegram_start_first_source_check";

ALTER TABLE "telegram_start" ADD CONSTRAINT "telegram_start_first_source_check"
  CHECK (
    "firstSource" = 'organic'
    OR "firstSource" = 'unknown'
    OR "firstSource" ~ '^src_[A-Za-z0-9_-]{1,60}$'
  );

ALTER TABLE "telegram_start" DROP CONSTRAINT "telegram_start_latest_source_check";

ALTER TABLE "telegram_start" ADD CONSTRAINT "telegram_start_latest_source_check"
  CHECK (
    "latestSource" IS NULL
    OR "latestSource" = 'organic'
    OR "latestSource" = 'unknown'
    OR "latestSource" ~ '^src_[A-Za-z0-9_-]{1,60}$'
  );

CREATE TABLE "traffic_source_code" (
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traffic_source_code_pkey" PRIMARY KEY ("code"),
    CONSTRAINT "traffic_source_code_code_check" CHECK (
        "code" ~ '^src_[A-Za-z0-9_-]{1,60}$'
    )
);

CREATE TABLE "telegram_start_log" (
    "id" BIGSERIAL NOT NULL,
    "telegramId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_start_log_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "telegram_start_log_source_check" CHECK (
        "source" = 'organic'
        OR "source" = 'unknown'
        OR "source" ~ '^src_[A-Za-z0-9_-]{1,60}$'
    )
);

CREATE INDEX "idx_telegram_start_log_created_at" ON "telegram_start_log"("createdAt" DESC);

CREATE INDEX "idx_telegram_start_log_source" ON "telegram_start_log"("source");
