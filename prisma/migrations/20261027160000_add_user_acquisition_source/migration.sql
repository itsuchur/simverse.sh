-- AlterTable
ALTER TABLE "user" ADD COLUMN "acquisitionSource" TEXT;

ALTER TABLE "user" ADD CONSTRAINT "user_acquisition_source_check"
  CHECK (
    "acquisitionSource" IS NULL
    OR "acquisitionSource" = 'organic'
    OR "acquisitionSource" ~ '^src_[A-Za-z0-9_-]{1,60}$'
  );
