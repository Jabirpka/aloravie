-- Customer: Google linkage + phone verification
ALTER TABLE "customers" ADD COLUMN "googleSub" TEXT;
ALTER TABLE "customers" ADD COLUMN "phoneVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "customers" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "customers_googleSub_key" ON "customers"("googleSub");

-- One-time phone verification codes (stored hashed)
CREATE TABLE "phone_otps" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "phone_otps_customerId_idx" ON "phone_otps"("customerId");

ALTER TABLE "phone_otps" ADD CONSTRAINT "phone_otps_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
