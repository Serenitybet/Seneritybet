-- AlterTable
ALTER TABLE "Tpe" ADD COLUMN "dailyCreditXAF" BIGINT,
ADD COLUMN "lastDailyResetAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TpeCreditAdjustment" ALTER COLUMN "adminId" DROP NOT NULL;
