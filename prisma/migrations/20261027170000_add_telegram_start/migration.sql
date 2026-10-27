-- CreateTable
CREATE TABLE "telegram_start" (
    "telegramId" TEXT NOT NULL,
    "firstSource" TEXT NOT NULL,
    "latestSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_start_pkey" PRIMARY KEY ("telegramId"),
    CONSTRAINT "telegram_start_first_source_check" CHECK (
        "firstSource" = 'organic'
        OR "firstSource" ~ '^src_[A-Za-z0-9_-]{1,60}$'
    ),
    CONSTRAINT "telegram_start_latest_source_check" CHECK (
        "latestSource" IS NULL
        OR "latestSource" = 'organic'
        OR "latestSource" ~ '^src_[A-Za-z0-9_-]{1,60}$'
    )
);
