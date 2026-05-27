-- AlterEnum: add CASHIER role
ALTER TYPE "Role" ADD VALUE 'CASHIER';

-- AlterEnum: add CASH payment provider (for physical shop deposits/withdrawals)
ALTER TYPE "PaymentProvider" ADD VALUE 'CASH';
