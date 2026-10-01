-- CreateTable
CREATE TABLE "excluded_country_codes" (
    "id" BIGSERIAL NOT NULL,
    "reseller_code" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "excluded_country_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_excluded_country_codes_reseller_country"
ON "excluded_country_codes"("reseller_code", "country_code");

-- CreateIndex
CREATE INDEX "idx_excluded_country_codes_reseller_code"
ON "excluded_country_codes"("reseller_code");
