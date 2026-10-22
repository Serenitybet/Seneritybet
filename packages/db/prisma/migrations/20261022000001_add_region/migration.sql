-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxWinXAF" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Region_name_key" ON "Region"("name");

-- AlterTable
ALTER TABLE "Tpe" ADD COLUMN "regionId" TEXT;

-- CreateIndex
CREATE INDEX "Tpe_regionId_idx" ON "Tpe"("regionId");

-- AddForeignKey
ALTER TABLE "Tpe" ADD CONSTRAINT "Tpe_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;
