-- AlterTable
ALTER TABLE "user" ADD COLUMN "preferredLanguage" TEXT,
ADD COLUMN "dataUsageNotifications" BOOLEAN NOT NULL DEFAULT true;
