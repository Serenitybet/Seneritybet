-- AlterTable
ALTER TABLE "User" ADD COLUMN "cashierCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_cashierCode_key" ON "User"("cashierCode");

-- CreateIndex
CREATE INDEX "User_cashierCode_idx" ON "User"("cashierCode");
