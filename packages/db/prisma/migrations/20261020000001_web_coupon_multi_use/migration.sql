-- Un code de coupon web reste valable (et réutilisable) jusqu'à expiration
-- au lieu d'être à usage unique — un même code peut donner lieu à
-- plusieurs tickets (un parieur peut le partager avec des amis). La
-- relation WebCoupon <-> Ticket passe donc de 1-1 (WebCoupon.ticketId) à
-- 1-N (Ticket.webCouponId).

-- DropForeignKey
ALTER TABLE "WebCoupon" DROP CONSTRAINT "WebCoupon_ticketId_fkey";

-- DropIndex
DROP INDEX "WebCoupon_ticketId_key";

-- AlterTable
ALTER TABLE "WebCoupon" DROP COLUMN "ticketId";

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "webCouponId" TEXT;

-- CreateIndex
CREATE INDEX "Ticket_webCouponId_idx" ON "Ticket"("webCouponId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_webCouponId_fkey" FOREIGN KEY ("webCouponId") REFERENCES "WebCoupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
