-- CreateTable
CREATE TABLE "excluded_package_codes" (
    "id" BIGSERIAL NOT NULL,
    "reseller_code" TEXT NOT NULL,
    "package_code" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "excluded_package_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_excluded_package_codes_reseller_package"
ON "excluded_package_codes"("reseller_code", "package_code");

-- CreateIndex
CREATE INDEX "idx_excluded_package_codes_reseller_code"
ON "excluded_package_codes"("reseller_code");
