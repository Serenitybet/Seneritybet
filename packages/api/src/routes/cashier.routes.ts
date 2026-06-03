import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { AppError } from "../middleware/error.middleware";

export const cashierRouter = Router();
cashierRouter.use(authenticate);
cashierRouter.use(requireRole("CASHIER", "ADMIN", "SUPER_ADMIN"));

// ─── Rechercher un client par téléphone ──────────────────────────────────────
cashierRouter.get("/customer/:phone", asyncHandler(async (req: AuthRequest, res: Response) => {
  const { phone } = req.params;

  const player = await prisma.user.findUnique({
    where: { phone },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      status: true,
      kycStatus: true,
      wallet: { select: { balance: true, bonusBalance: true } },
    },
  });

  if (!player) {
    res.status(404).json({ success: false, error: "Client introuvable avec ce numéro" });
    return;
  }

  if (player.status !== "ACTIVE") {
    res.status(403).json({ success: false, error: "Ce compte est suspendu" });
    return;
  }

  res.json({
    success: true,
    data: {
      id: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      phone: player.phone,
      kycStatus: player.kycStatus,
      // Solde masqué — le caissier ne doit pas voir le solde du joueur
      hasWallet: !!player.wallet,
    },
  });
}));

// ─── Dépôt espèces ───────────────────────────────────────────────────────────
cashierRouter.post("/deposit", asyncHandler(async (req: AuthRequest, res: Response) => {
  const { playerId, amount, notes } = req.body;

  if (!playerId || !amount) throw new AppError(400, "playerId et amount sont requis");

  const amountCentimes = BigInt(Math.round(Number(amount)));
  const MIN = BigInt(50_000);   // 500 XAF minimum

  if (amountCentimes < MIN) throw new AppError(400, "Montant minimum de dépôt : 500 XAF");

  const player = await prisma.user.findUnique({
    where: { id: playerId },
    include: { wallet: true },
  });

  if (!player) throw new AppError(404, "Client introuvable");
  if (player.status !== "ACTIVE") throw new AppError(403, "Compte client suspendu");
  if (!player.wallet) throw new AppError(400, "Portefeuille non initialisé");

  const [updatedWallet, transaction] = await prisma.$transaction([
    prisma.wallet.update({
      where: { id: player.wallet.id },
      data: { balance: { increment: amountCentimes } },
    }),
    prisma.transaction.create({
      data: {
        walletId: player.wallet.id,
        userId: player.id,
        type: "DEPOSIT",
        amount: amountCentimes,
        balanceBefore: player.wallet.balance,
        balanceAfter: player.wallet.balance + amountCentimes,
        status: "COMPLETED",
        provider: "CASH",
        metadata: {
          cashierId: req.user!.id,
          cashierEmail: req.user!.email,
          shopId: req.user!.shopId ?? null,
          notes: notes ?? null,
          channel: "POS",
        },
      },
    }),
  ]);

  res.status(201).json({
    success: true,
    data: {
      transactionId: transaction.id,
      playerName: `${player.firstName} ${player.lastName}`,
      phone: player.phone,
      amountXAF: Number(amountCentimes) / 100,
      newBalanceXAF: Number(updatedWallet.balance) / 100,
      createdAt: transaction.createdAt,
    },
  });
}));

// ─── Retrait espèces ──────────────────────────────────────────────────────────
cashierRouter.post("/withdraw", asyncHandler(async (req: AuthRequest, res: Response) => {
  const { playerId, amount, notes, playerPassword } = req.body;

  if (!playerId || !amount) throw new AppError(400, "playerId et amount sont requis");
  if (!playerPassword) throw new AppError(400, "Le mot de passe du joueur est requis pour authoriser le retrait");

  const amountCentimes = BigInt(Math.round(Number(amount)));
  const MIN = BigInt(100_000);      // 1 000 XAF minimum
  const MAX = BigInt(50_000_000);   // 500 000 XAF maximum

  if (amountCentimes < MIN) throw new AppError(400, "Montant minimum de retrait : 1 000 XAF");
  if (amountCentimes > MAX) throw new AppError(400, "Montant maximum de retrait : 500 000 XAF");

  const player = await prisma.user.findUnique({
    where: { id: playerId },
    include: { wallet: true },
  });

  if (!player) throw new AppError(404, "Client introuvable");
  if (player.status !== "ACTIVE") throw new AppError(403, "Compte client suspendu");
  if (!player.wallet) throw new AppError(400, "Portefeuille non initialisé");

  // Vérifier le mot de passe du joueur avant tout retrait
  const passwordValid = await bcrypt.compare(playerPassword, player.password);
  if (!passwordValid) throw new AppError(401, "Mot de passe du joueur incorrect — retrait refusé");

  if (player.wallet.balance < amountCentimes) throw new AppError(400, "Solde insuffisant");

  const [updatedWallet, transaction] = await prisma.$transaction([
    prisma.wallet.update({
      where: { id: player.wallet.id },
      data: { balance: { decrement: amountCentimes } },
    }),
    prisma.transaction.create({
      data: {
        walletId: player.wallet.id,
        userId: player.id,
        type: "WITHDRAWAL",
        amount: -amountCentimes,
        balanceBefore: player.wallet.balance,
        balanceAfter: player.wallet.balance - amountCentimes,
        status: "COMPLETED",
        provider: "CASH",
        metadata: {
          cashierId: req.user!.id,
          cashierEmail: req.user!.email,
          notes: notes ?? null,
          channel: "POS",
        },
      },
    }),
  ]);

  res.status(201).json({
    success: true,
    data: {
      transactionId: transaction.id,
      playerName: `${player.firstName} ${player.lastName}`,
      phone: player.phone,
      amountXAF: Number(amountCentimes) / 100,
      newBalanceXAF: Number(updatedWallet.balance) / 100,
      createdAt: transaction.createdAt,
    },
  });
}));

// ─── Retraits en attente — recherche par ID joueur ───────────────────────────
cashierRouter.get("/pending-withdrawals/:playerNumber", asyncHandler(async (req: AuthRequest, res: Response) => {
  const playerNumber = parseInt(req.params.playerNumber, 10);
  if (isNaN(playerNumber)) throw new AppError(400, "Numéro joueur invalide");

  const player = await prisma.user.findUnique({
    where: { playerNumber },
    select: { id: true, firstName: true, lastName: true, phone: true, status: true },
  });
  if (!player) throw new AppError(404, "Joueur introuvable");
  if (player.status !== "ACTIVE") throw new AppError(403, "Compte joueur suspendu");

  // Expirer automatiquement les demandes expirées
  await prisma.withdrawalRequest.updateMany({
    where: { userId: player.id, status: "PENDING", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });

  const requests = await prisma.withdrawalRequest.findMany({
    where: { userId: player.id, status: "PENDING" },
    include: { shop: { select: { name: true, city: true } } },
    orderBy: { createdAt: "desc" },
  });

  res.json({
    success: true,
    data: {
      player: { id: player.id, firstName: player.firstName, lastName: player.lastName, phone: player.phone },
      pendingWithdrawals: requests.map(r => ({
        id: r.id,
        requestCode: r.requestCode,
        amountXAF: Number(r.amount) / 100,
        shop: r.shop,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
      })),
    },
  });
}));

// POST /api/cashier/validate-withdrawal/:id — caissier valide un retrait
cashierRouter.post("/validate-withdrawal/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  const request = await prisma.withdrawalRequest.findUnique({
    where: { id: req.params.id },
    include: {
      user: { include: { wallet: true } },
      shop: true,
    },
  });

  if (!request) throw new AppError(404, "Demande de retrait introuvable");
  if (request.status !== "PENDING") throw new AppError(400, `Demande déjà ${request.status.toLowerCase()}`);
  if (new Date() > request.expiresAt) {
    await prisma.withdrawalRequest.update({ where: { id: request.id }, data: { status: "EXPIRED" } });
    throw new AppError(400, "Cette demande a expiré — le montant sera remboursé automatiquement");
  }

  // Créer la transaction de retrait et valider la demande
  const [updatedRequest, transaction] = await prisma.$transaction([
    prisma.withdrawalRequest.update({
      where: { id: request.id },
      data: { status: "VALIDATED", cashierId: req.user!.id, completedAt: new Date() },
    }),
    prisma.transaction.create({
      data: {
        walletId: request.user.wallet!.id,
        userId: request.userId,
        type: "WITHDRAWAL",
        amount: -request.amount,
        balanceBefore: request.user.wallet!.balance + request.amount, // déjà déduit à la création
        balanceAfter: request.user.wallet!.balance,
        status: "COMPLETED",
        provider: "CASH",
        metadata: {
          cashierId: req.user!.id,
          cashierEmail: req.user!.email,
          requestCode: request.requestCode,
          shopId: request.shopId,
          channel: "POS_WITHDRAWAL",
        },
      },
    }),
  ]);

  res.json({
    success: true,
    data: {
      transactionId: transaction.id,
      playerName: `${request.user.firstName} ${request.user.lastName}`,
      phone: request.user.phone,
      amountXAF: Number(request.amount) / 100,
      requestCode: request.requestCode,
      shop: request.shop.name,
      completedAt: updatedRequest.completedAt,
    },
  });
}));

// ─── Transactions du jour (pour clôture de caisse) ────────────────────────────
cashierRouter.get("/transactions", asyncHandler(async (req: AuthRequest, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const cashierId = req.user!.id;
  const shopId    = req.user!.shopId;

  // Filtrer par boutique si le caissier en a une, sinon par caissier uniquement
  const allCashTx = await prisma.transaction.findMany({
    where: {
      provider: "CASH",
      createdAt: { gte: today, lt: tomorrow },
    },
    include: {
      user: { select: { firstName: true, lastName: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  // Filtrer côté JS sur metadata.shopId ou metadata.cashierId
  const transactions = allCashTx.filter(t => {
    const meta = t.metadata as Record<string, unknown> | null;
    if (shopId) {
      // Caissier assigné à une boutique → on montre toutes les tx de cette boutique
      return meta?.shopId === shopId;
    }
    // Pas de boutique → on montre uniquement les tx de ce caissier
    return meta?.cashierId === cashierId;
  });

  const deposits = transactions.filter(t => t.type === "DEPOSIT");
  const withdrawals = transactions.filter(t => t.type === "WITHDRAWAL");

  const stats = {
    totalDepositsXAF: deposits.reduce((s, t) => s + Number(t.amount), 0) / 100,
    totalWithdrawalsXAF: withdrawals.reduce((s, t) => s + Math.abs(Number(t.amount)), 0) / 100,
    countDeposits: deposits.length,
    countWithdrawals: withdrawals.length,
    netXAF: (deposits.reduce((s, t) => s + Number(t.amount), 0) +
      withdrawals.reduce((s, t) => s + Number(t.amount), 0)) / 100,
  };

  res.json({
    success: true,
    data: {
      transactions: transactions.map(t => ({
        id: t.id,
        type: t.type,
        amountXAF: Math.abs(Number(t.amount)) / 100,
        status: t.status,
        createdAt: t.createdAt,
        player: t.user,
      })),
      stats,
    },
  });
}));
