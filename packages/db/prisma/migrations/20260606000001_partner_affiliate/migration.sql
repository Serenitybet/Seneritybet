-- Enums
CREATE TYPE "PartnerStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');
CREATE TYPE "PartnerWithdrawalStatus" AS ENUM ('PENDING', 'PAID', 'REJECTED');

-- Table partenaires
CREATE TABLE "Partner" (
  "id"             TEXT    NOT NULL,
  "email"          TEXT    NOT NULL,
  "phone"          TEXT    NOT NULL,
  "password"       TEXT    NOT NULL,
  "firstName"      TEXT    NOT NULL,
  "lastName"       TEXT    NOT NULL,
  "bio"            TEXT,
  "socialMedia"    TEXT,
  "promoCode"      TEXT    NOT NULL,
  "commissionRate" FLOAT8  NOT NULL DEFAULT 0.10,
  "status"         "PartnerStatus" NOT NULL DEFAULT 'PENDING',
  "balance"        FLOAT8  NOT NULL DEFAULT 0,
  "totalEarned"    FLOAT8  NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Partner_email_key"     ON "Partner"("email");
CREATE UNIQUE INDEX "Partner_phone_key"     ON "Partner"("phone");
CREATE UNIQUE INDEX "Partner_promoCode_key" ON "Partner"("promoCode");
CREATE INDEX "Partner_status_idx"           ON "Partner"("status");

-- Table parrainages
CREATE TABLE "PartnerReferral" (
  "id"        TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerReferral_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PartnerReferral_userId_key" ON "PartnerReferral"("userId");
CREATE INDEX "PartnerReferral_partnerId_idx"     ON "PartnerReferral"("partnerId");
ALTER TABLE "PartnerReferral"
  ADD CONSTRAINT "PartnerReferral_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id"),
  ADD CONSTRAINT "PartnerReferral_userId_fkey"    FOREIGN KEY ("userId")    REFERENCES "User"("id");

-- Table commissions
CREATE TABLE "PartnerCommission" (
  "id"          TEXT    NOT NULL,
  "partnerId"   TEXT    NOT NULL,
  "userId"      TEXT    NOT NULL,
  "betId"       TEXT,
  "amount"      FLOAT8  NOT NULL,
  "rate"        FLOAT8  NOT NULL,
  "description" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerCommission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PartnerCommission_partnerId_idx" ON "PartnerCommission"("partnerId");
ALTER TABLE "PartnerCommission"
  ADD CONSTRAINT "PartnerCommission_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id");

-- Table retraits partenaires
CREATE TABLE "PartnerWithdrawal" (
  "id"          TEXT NOT NULL,
  "partnerId"   TEXT NOT NULL,
  "amount"      FLOAT8 NOT NULL,
  "method"      TEXT NOT NULL,
  "account"     TEXT NOT NULL,
  "status"      "PartnerWithdrawalStatus" NOT NULL DEFAULT 'PENDING',
  "processedAt" TIMESTAMP(3),
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerWithdrawal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PartnerWithdrawal_partnerId_idx" ON "PartnerWithdrawal"("partnerId");
CREATE INDEX "PartnerWithdrawal_status_idx"    ON "PartnerWithdrawal"("status");
ALTER TABLE "PartnerWithdrawal"
  ADD CONSTRAINT "PartnerWithdrawal_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id");
