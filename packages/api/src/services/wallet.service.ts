import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error.middleware";
import { airtelService } from "./payment/airtel.service";
import { orangeService } from "./payment/orange.service";
import { moovService } from "./payment/moov.service";
import type { DepositPayload, WithdrawPayload, PaymentProvider } from "@serenitybet/shared";

const MIN_DEPOSIT = BigInt(50_000);   // 500 XAF
const MIN_WITHDRAW = BigInt(100_000); // 1 000 XAF
const MAX_WITHDRAW = BigInt(50_000_000); // 500 000 XAF

function getPaymentService(provider: PaymentProvider) {
  switch (provider) {
    case "AIRTEL_MONEY": return airtelService;
    case "ORANGE_MONEY": return orangeService;
    case "MOOV_MONEY":  return moovService;
  }
}

export async function deposit(userId: string, payload: DepositPayload) {
  const amount = BigInt(payload.amount);
  if (amount < MIN_DEPOSIT) throw new AppError(400, "Montant minimum de dépôt : 500 XAF");

  const service = getPaymentService(payload.provider);
  const paymentRef = await service.initiatePayment({
    amount: Number(amount),
    phone: payload.phoneNumber,
    reference: `DEP-${userId}-${Date.now()}`,
  });

  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new AppError(404, "Portefeuille introuvable");

  await prisma.transaction.create({
    data: {
      walletId: wallet.id,
      userId,
      type: "DEPOSIT",
      amount,
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance, // mis à jour à la confirmation webhook
      status: "PENDING",
      provider: payload.provider,
      providerRef: paymentRef,
      phoneNumber: payload.phoneNumber,
    },
  });

  return { reference: paymentRef, message: "Paiement initié, en attente de confirmation" };
}

export async function confirmDeposit(providerRef: string, provider: PaymentProvider) {
  const transaction = await prisma.transaction.findFirst({
    where: { providerRef, provider, status: "PENDING", type: "DEPOSIT" },
    include: { wallet: true },
  });

  if (!transaction) {
    console.warn(`Webhook reçu pour une transaction introuvable : ${providerRef}`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    const updatedWallet = await tx.wallet.update({
      where: { id: transaction.walletId },
      data: { balance: { increment: transaction.amount } },
    });

    await tx.transaction.update({
      where: { id: transaction.id },
      data: {
        status: "COMPLETED",
        balanceAfter: updatedWallet.balance,
      },
    });
  });
}

export async function withdraw(userId: string, payload: WithdrawPayload) {
  const amount = BigInt(payload.amount);
  if (amount < MIN_WITHDRAW) throw new AppError(400, "Montant minimum de retrait : 1 000 XAF");
  if (amount > MAX_WITHDRAW) throw new AppError(400, "Montant maximum de retrait : 500 000 XAF");

  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new AppError(404, "Portefeuille introuvable");
  if (wallet.balance < amount) throw new AppError(400, "Solde insuffisant");

  const service = getPaymentService(payload.provider);
  const paymentRef = await service.initiateTransfer({
    amount: Number(amount),
    phone: payload.phoneNumber,
    reference: `WIT-${userId}-${Date.now()}`,
  });

  await prisma.$transaction(async (tx) => {
    const updated = await tx.wallet.update({
      where: { userId },
      data: { balance: { decrement: amount } },
    });

    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        userId,
        type: "WITHDRAWAL",
        amount: -amount,
        balanceBefore: wallet.balance,
        balanceAfter: updated.balance,
        status: "PENDING",
        provider: payload.provider,
        providerRef: paymentRef,
        phoneNumber: payload.phoneNumber,
      },
    });
  });

  return { reference: paymentRef, message: "Retrait en cours de traitement" };
}

export async function getBalance(userId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new AppError(404, "Portefeuille introuvable");
  return { balance: Number(wallet.balance), bonusBalance: Number(wallet.bonusBalance) };
}

export async function getTransactions(userId: string, page: number, limit: number) {
  const [total, transactions] = await Promise.all([
    prisma.transaction.count({ where: { userId } }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { transactions, total, page, limit, totalPages: Math.ceil(total / limit) };
}
