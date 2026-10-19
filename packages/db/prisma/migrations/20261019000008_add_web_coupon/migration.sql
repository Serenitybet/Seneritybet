-- CreateEnum
CREATE TYPE "WebCouponStatus" AS ENUM ('PENDING', 'USED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "WebCoupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "selections" JSONB NOT NULL,
    "status" "WebCouponStatus" NOT NULL DEFAULT 'PENDING',
    "ticketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebCoupon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebCoupon_code_key" ON "WebCoupon"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WebCoupon_ticketId_key" ON "WebCoupon"("ticketId");

-- CreateIndex
CREATE INDEX "WebCoupon_status_idx" ON "WebCoupon"("status");

-- CreateIndex
CREATE INDEX "WebCoupon_expiresAt_idx" ON "WebCoupon"("expiresAt");

-- AddForeignKey
ALTER TABLE "WebCoupon" ADD CONSTRAINT "WebCoupon_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
