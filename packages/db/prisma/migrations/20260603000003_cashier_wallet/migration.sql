-- Portefeuille des caissiers (float espèces)
CREATE TABLE "CashierWallet" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "balance"   BIGINT NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashierWallet_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CashierWallet" ADD CONSTRAINT "CashierWallet_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "CashierWallet_userId_key" ON "CashierWallet"("userId");
CREATE INDEX "CashierWallet_userId_idx" ON "CashierWallet"("userId");

-- Créer un portefeuille pour les caissiers existants
INSERT INTO "CashierWallet" ("id", "userId", "balance", "updatedAt")
SELECT gen_random_uuid()::text, id, 0, NOW()
FROM "User"
WHERE role = 'CASHIER';
