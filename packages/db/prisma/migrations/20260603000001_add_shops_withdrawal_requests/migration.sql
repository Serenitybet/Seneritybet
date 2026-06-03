-- Enum pour le statut des demandes de retrait
CREATE TYPE "WithdrawalRequestStatus" AS ENUM ('PENDING', 'VALIDATED', 'CANCELLED', 'EXPIRED');

-- Table des boutiques (salles de jeux physiques)
CREATE TABLE "Shop" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "city"      TEXT NOT NULL,
  "address"   TEXT,
  "phone"     TEXT,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Shop_city_idx"     ON "Shop"("city");
CREATE INDEX "Shop_isActive_idx" ON "Shop"("isActive");

-- Table des demandes de retrait espèces
CREATE TABLE "WithdrawalRequest" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "shopId"      TEXT NOT NULL,
  "amount"      BIGINT NOT NULL,
  "status"      "WithdrawalRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestCode" TEXT NOT NULL,
  "cashierId"   TEXT,
  "completedAt" TIMESTAMP(3),
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "WithdrawalRequest_requestCode_key" ON "WithdrawalRequest"("requestCode");
CREATE INDEX "WithdrawalRequest_userId_idx"      ON "WithdrawalRequest"("userId");
CREATE INDEX "WithdrawalRequest_shopId_idx"      ON "WithdrawalRequest"("shopId");
CREATE INDEX "WithdrawalRequest_status_idx"      ON "WithdrawalRequest"("status");
CREATE INDEX "WithdrawalRequest_requestCode_idx" ON "WithdrawalRequest"("requestCode");
CREATE INDEX "WithdrawalRequest_expiresAt_idx"   ON "WithdrawalRequest"("expiresAt");

-- Données initiales : boutiques de N'Djamena
INSERT INTO "Shop" ("id", "name", "city", "address", "phone") VALUES
  (gen_random_uuid()::text, 'Serenitybet Farcha',       'N''Djamena', 'Quartier Farcha',        '+235 66 00 00 01'),
  (gen_random_uuid()::text, 'Serenitybet Moursal',      'N''Djamena', 'Quartier Moursal',        '+235 66 00 00 02'),
  (gen_random_uuid()::text, 'Serenitybet Paris Congo',  'N''Djamena', 'Paris Congo',             '+235 66 00 00 03'),
  (gen_random_uuid()::text, 'Serenitybet Diguel',       'N''Djamena', 'Quartier Diguel',         '+235 66 00 00 04'),
  (gen_random_uuid()::text, 'Serenitybet Amriguébé',    'N''Djamena', 'Quartier Amriguébé',      '+235 66 00 00 05'),
  (gen_random_uuid()::text, 'Serenitybet Moundou',      'Moundou',    'Centre ville Moundou',    '+235 66 00 00 06'),
  (gen_random_uuid()::text, 'Serenitybet Sarh',         'Sarh',       'Centre ville Sarh',       '+235 66 00 00 07'),
  (gen_random_uuid()::text, 'Serenitybet Abéché',       'Abéché',     'Centre ville Abéché',     '+235 66 00 00 08');
