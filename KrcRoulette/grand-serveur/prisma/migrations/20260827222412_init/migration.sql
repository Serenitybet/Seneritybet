-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN_VILLE', 'CAISSIER');

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('SUPER_TO_VILLE', 'VILLE_TO_SHOP', 'SHOP_DEBIT_BET', 'SHOP_CREDIT_PAYOUT');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('OPEN', 'CLOSED', 'SETTLED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('PENDING', 'WON', 'LOST', 'PAID', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BetType" AS ENUM ('NUMBER', 'COLOR', 'PARITY', 'DOZEN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "villeId" TEXT,
    "shopId" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ville" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "creditBalance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ville_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "villeId" TEXT NOT NULL,
    "workCode" TEXT NOT NULL,
    "creditBalance" INTEGER NOT NULL DEFAULT 0,
    "creditAlertThreshold" INTEGER NOT NULL DEFAULT 5000,
    "roundTimerSeconds" INTEGER NOT NULL DEFAULT 30,
    "bonusModeActive" BOOLEAN NOT NULL DEFAULT false,
    "bonusModeExpiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "villeId" TEXT,
    "shopId" TEXT,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "note" TEXT,
    "performedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdminCredit" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuperAdminCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isGlobalActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopGame" (
    "shopId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ShopGame_pkey" PRIMARY KEY ("shopId","gameId")
);

-- CreateTable
CREATE TABLE "RouletteRound" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),
    "winningNumber" INTEGER,
    "winningColor" TEXT,

    CONSTRAINT "RouletteRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "ticketCode" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "roundId" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'PENDING',
    "totalStake" INTEGER NOT NULL,
    "totalPayout" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketBet" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "betType" "BetType" NOT NULL,
    "betValue" TEXT NOT NULL,
    "stake" INTEGER NOT NULL,
    "payoutMultiplier" DOUBLE PRECISION NOT NULL,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "payoutAmount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TicketBet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RtpConfig" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "targetRtp" DOUBLE PRECISION NOT NULL DEFAULT 85,
    "bonusRtp" DOUBLE PRECISION NOT NULL DEFAULT 90,
    "alertYellow" DOUBLE PRECISION NOT NULL DEFAULT 88,
    "alertRed" DOUBLE PRECISION NOT NULL DEFAULT 92,
    "shopId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RtpConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RtpDailyStat" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalWagered" INTEGER NOT NULL DEFAULT 0,
    "totalPaid" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RtpDailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReport" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalWagered" INTEGER NOT NULL,
    "totalPaid" INTEGER NOT NULL,
    "ticketsCount" INTEGER NOT NULL,
    "rtp" DOUBLE PRECISION NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_villeId_idx" ON "User"("villeId");

-- CreateIndex
CREATE INDEX "User_shopId_idx" ON "User"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Ville_name_key" ON "Ville"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_workCode_key" ON "Shop"("workCode");

-- CreateIndex
CREATE INDEX "Shop_villeId_idx" ON "Shop"("villeId");

-- CreateIndex
CREATE INDEX "CreditTransaction_villeId_idx" ON "CreditTransaction"("villeId");

-- CreateIndex
CREATE INDEX "CreditTransaction_shopId_idx" ON "CreditTransaction"("shopId");

-- CreateIndex
CREATE INDEX "CreditTransaction_createdAt_idx" ON "CreditTransaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Game_key_key" ON "Game"("key");

-- CreateIndex
CREATE INDEX "RouletteRound_shopId_status_idx" ON "RouletteRound"("shopId", "status");

-- CreateIndex
CREATE INDEX "RouletteRound_shopId_roundNumber_idx" ON "RouletteRound"("shopId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_ticketCode_key" ON "Ticket"("ticketCode");

-- CreateIndex
CREATE INDEX "Ticket_shopId_status_idx" ON "Ticket"("shopId", "status");

-- CreateIndex
CREATE INDEX "Ticket_roundId_idx" ON "Ticket"("roundId");

-- CreateIndex
CREATE INDEX "TicketBet_ticketId_idx" ON "TicketBet"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "RtpConfig_shopId_key" ON "RtpConfig"("shopId");

-- CreateIndex
CREATE INDEX "RtpDailyStat_shopId_date_idx" ON "RtpDailyStat"("shopId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RtpDailyStat_shopId_date_key" ON "RtpDailyStat"("shopId", "date");

-- CreateIndex
CREATE INDEX "DailyReport_shopId_date_idx" ON "DailyReport"("shopId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_shopId_date_key" ON "DailyReport"("shopId", "date");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_villeId_fkey" FOREIGN KEY ("villeId") REFERENCES "Ville"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_villeId_fkey" FOREIGN KEY ("villeId") REFERENCES "Ville"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_villeId_fkey" FOREIGN KEY ("villeId") REFERENCES "Ville"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopGame" ADD CONSTRAINT "ShopGame_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopGame" ADD CONSTRAINT "ShopGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouletteRound" ADD CONSTRAINT "RouletteRound_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "RouletteRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketBet" ADD CONSTRAINT "TicketBet_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RtpConfig" ADD CONSTRAINT "RtpConfig_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RtpDailyStat" ADD CONSTRAINT "RtpDailyStat_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
