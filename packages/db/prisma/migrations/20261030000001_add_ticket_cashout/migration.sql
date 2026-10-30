-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE 'CASHED_OUT_PENDING';

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "cashedOutAmount" BIGINT,
ADD COLUMN "cashedOutAt" TIMESTAMP(3);
