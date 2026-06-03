-- Ajouter shopId optionnel aux utilisateurs (pour les caissiers)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "shopId" TEXT;

ALTER TABLE "User" ADD CONSTRAINT "User_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "User_shopId_idx" ON "User"("shopId");
