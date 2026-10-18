-- CreateEnum
CREATE TYPE "TpeStatus" AS ENUM ('PENDING_PAIRING', 'ACTIVE', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('PENDING', 'WON', 'LOST', 'REFUNDED', 'CANCELLED', 'PAID');

-- CreateTable
CREATE TABLE "Tpe" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "deviceSecretHash" TEXT NOT NULL,
    "pairingCode" TEXT,
    "status" "TpeStatus" NOT NULL DEFAULT 'PENDING_PAIRING',
    "credit" BIGINT NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3),
    "pairedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tpe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TpeCreditAdjustment" (
    "id" TEXT NOT NULL,
    "tpeId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "reason" TEXT,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TpeCreditAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tpeId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "stake" BIGINT NOT NULL,
    "totalOdds" DECIMAL(10,3) NOT NULL,
    "potentialWin" BIGINT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'PENDING',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "settledAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paidByTpeId" TEXT,
    "paidByCashierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketItem" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "oddId" TEXT NOT NULL,
    "oddValue" DECIMAL(8,3) NOT NULL,
    "result" "BetItemResult",

    CONSTRAINT "TicketItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tpe_code_key" ON "Tpe"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Tpe_deviceSecretHash_key" ON "Tpe"("deviceSecretHash");

-- CreateIndex
CREATE UNIQUE INDEX "Tpe_pairingCode_key" ON "Tpe"("pairingCode");

-- CreateIndex
CREATE INDEX "Tpe_status_idx" ON "Tpe"("status");

-- CreateIndex
CREATE INDEX "Tpe_pairingCode_idx" ON "Tpe"("pairingCode");

-- CreateIndex
CREATE INDEX "TpeCreditAdjustment_tpeId_idx" ON "TpeCreditAdjustment"("tpeId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_code_key" ON "Ticket"("code");

-- CreateIndex
CREATE INDEX "Ticket_tpeId_idx" ON "Ticket"("tpeId");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Ticket_code_idx" ON "Ticket"("code");

-- CreateIndex
CREATE INDEX "Ticket_createdAt_idx" ON "Ticket"("createdAt");

-- CreateIndex
CREATE INDEX "TicketItem_ticketId_idx" ON "TicketItem"("ticketId");

-- CreateIndex
CREATE INDEX "TicketItem_marketId_idx" ON "TicketItem"("marketId");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- AddForeignKey
ALTER TABLE "TpeCreditAdjustment" ADD CONSTRAINT "TpeCreditAdjustment_tpeId_fkey" FOREIGN KEY ("tpeId") REFERENCES "Tpe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TpeCreditAdjustment" ADD CONSTRAINT "TpeCreditAdjustment_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_tpeId_fkey" FOREIGN KEY ("tpeId") REFERENCES "Tpe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_paidByTpeId_fkey" FOREIGN KEY ("paidByTpeId") REFERENCES "Tpe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_paidByCashierId_fkey" FOREIGN KEY ("paidByCashierId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketItem" ADD CONSTRAINT "TicketItem_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketItem" ADD CONSTRAINT "TicketItem_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketItem" ADD CONSTRAINT "TicketItem_oddId_fkey" FOREIGN KEY ("oddId") REFERENCES "Odd"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
