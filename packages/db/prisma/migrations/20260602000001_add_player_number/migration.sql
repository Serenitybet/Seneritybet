-- Créer une séquence qui commence à 100001
CREATE SEQUENCE IF NOT EXISTS "User_playerNumber_seq" START WITH 100001 INCREMENT BY 1;

-- Ajouter le champ playerNumber avec la séquence
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "playerNumber" INTEGER NOT NULL DEFAULT nextval('"User_playerNumber_seq"');

-- Mettre à jour les utilisateurs existants (leur assigner un numéro séquentiel)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) AS rn
  FROM "User"
)
UPDATE "User"
SET "playerNumber" = 99999 + ranked.rn
FROM ranked
WHERE "User".id = ranked.id;

-- Mettre à jour la séquence pour continuer après les existants
SELECT setval('"User_playerNumber_seq"', COALESCE((SELECT MAX("playerNumber") FROM "User"), 100000));

-- Ajouter contrainte unique
ALTER TABLE "User" ADD CONSTRAINT "User_playerNumber_key" UNIQUE ("playerNumber");

-- Index
CREATE INDEX IF NOT EXISTS "User_playerNumber_idx" ON "User"("playerNumber");
