-- Coupons sauvegardés pour tickets physiques en salle de jeux
CREATE TABLE "SavedCoupon" (
  "id"             TEXT         NOT NULL,
  "code"           TEXT         NOT NULL,
  "userId"         TEXT,
  "selections"     JSONB        NOT NULL,
  "suggestedStake" BIGINT,
  "status"         TEXT         NOT NULL DEFAULT 'PENDING',
  "expiresAt"      TIMESTAMP(3) NOT NULL,
  "usedAt"         TIMESTAMP(3),
  "betId"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedCoupon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavedCoupon_code_key"    ON "SavedCoupon"("code");
CREATE INDEX "SavedCoupon_userId_idx"   ON "SavedCoupon"("userId");
CREATE INDEX "SavedCoupon_status_idx"   ON "SavedCoupon"("status");

ALTER TABLE "SavedCoupon"
  ADD CONSTRAINT "SavedCoupon_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
