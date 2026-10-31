-- CreateTable
CREATE TABLE "TpeCashier" (
    "id" TEXT NOT NULL,
    "tpeId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TpeCashier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TpeCashier_cashierId_idx" ON "TpeCashier"("cashierId");

-- CreateIndex
CREATE UNIQUE INDEX "TpeCashier_tpeId_cashierId_key" ON "TpeCashier"("tpeId", "cashierId");

-- AddForeignKey
ALTER TABLE "TpeCashier" ADD CONSTRAINT "TpeCashier_tpeId_fkey" FOREIGN KEY ("tpeId") REFERENCES "Tpe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TpeCashier" ADD CONSTRAINT "TpeCashier_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
