import { Router, Request, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { AppError } from "../middleware/error.middleware";

export const cashierWalletRouter = Router();
cashierWalletRouter.use(authenticate);

// GET /api/cashier-wallet/my — caissier voit son solde
cashierWalletRouter.get("/my", requireRole("CASHIER", "ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    let wallet = await prisma.cashierWallet.findUnique({
      where: { userId: req.user!.id },
    });

    // Créer le wallet s'il n'existe pas encore
    if (!wallet) {
      wallet = await prisma.cashierWallet.create({
        data: { userId: req.user!.id, balance: BigInt(0) },
      });
    }

    res.json({
      success: true,
      data: {
        balanceXAF: Number(wallet.balance) / 100,
        updatedAt:  wallet.updatedAt,
      },
    });
  }),
);

// POST /api/cashier-wallet/recharge/:userId — admin recharge le wallet d'un caissier
cashierWalletRouter.post("/recharge/:userId", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { amount, notes } = req.body;
    if (!amount || Number(amount) <= 0) throw new AppError(400, "Montant invalide");

    const amountCentimes = BigInt(Math.round(Number(amount) * 100));

    const cashier = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: { id: true, firstName: true, lastName: true, role: true },
    });
    if (!cashier) throw new AppError(404, "Caissier introuvable");
    if (cashier.role !== "CASHIER") throw new AppError(400, "Cet utilisateur n'est pas un caissier");

    // Upsert : créer ou mettre à jour le wallet
    const wallet = await prisma.cashierWallet.upsert({
      where:  { userId: req.params.userId },
      update: { balance: { increment: amountCentimes } },
      create: { userId: req.params.userId, balance: amountCentimes },
    });

    res.json({
      success: true,
      data: {
        cashierName:   `${cashier.firstName} ${cashier.lastName}`,
        rechargedXAF:  Number(amountCentimes) / 100,
        newBalanceXAF: Number(wallet.balance) / 100,
        notes: notes ?? null,
      },
    });
  }),
);

// GET /api/cashier-wallet/all — admin liste tous les wallets caissiers
cashierWalletRouter.get("/all", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (_req: Request, res: Response) => {
    const wallets = await prisma.cashierWallet.findMany({
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
      orderBy: { balance: "desc" },
    });

    res.json({
      success: true,
      data: wallets.map(w => ({
        userId:      w.userId,
        cashierName: `${w.user.firstName} ${w.user.lastName}`,
        email:       w.user.email,
        phone:       w.user.phone,
        balanceXAF:  Number(w.balance) / 100,
        updatedAt:   w.updatedAt,
      })),
    });
  }),
);
