import { Router, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { AppError } from "../middleware/error.middleware";

export const couponRouter = Router();
couponRouter.use(authenticate);

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (i < 2) code += "-";
  }
  return code; // Ex: ABX-7392-KLP
}

// POST /api/coupons/save — joueur sauvegarde son coupon
couponRouter.post("/save", requireRole("PLAYER"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { selections, suggestedStake } = req.body;

    if (!selections || !Array.isArray(selections) || selections.length === 0) {
      throw new AppError(400, "Aucune sélection dans le coupon");
    }
    if (selections.length > 15) {
      throw new AppError(400, "Maximum 15 événements par coupon");
    }

    // Vérifier qu'il n'y a pas déjà un coupon PENDING actif
    const existing = await prisma.savedCoupon.findFirst({
      where: { userId: req.user!.id, status: "PENDING", expiresAt: { gt: new Date() } },
    });
    if (existing) {
      return res.json({
        success: true,
        data: { code: existing.code, expiresAt: existing.expiresAt, alreadyExists: true },
      });
    }

    // Générer un code unique
    let code = generateCode();
    while (await prisma.savedCoupon.findUnique({ where: { code } })) {
      code = generateCode();
    }

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

    const coupon = await prisma.savedCoupon.create({
      data: {
        code,
        userId: req.user!.id,
        selections,
        suggestedStake: suggestedStake ? BigInt(Math.round(suggestedStake)) : null,
        expiresAt,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        code:          coupon.code,
        selectionsCount: selections.length,
        suggestedStakeXAF: suggestedStake ? Number(suggestedStake) / 100 : null,
        expiresAt:     coupon.expiresAt,
      },
    });
  }),
);

// GET /api/coupons/my — liste des coupons actifs du joueur
couponRouter.get("/my", requireRole("PLAYER"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const coupons = await prisma.savedCoupon.findMany({
      where: { userId: req.user!.id, status: "PENDING", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    res.json({
      success: true,
      data: coupons.map(c => ({
        id:        c.id,
        code:      c.code,
        count:     (c.selections as any[]).length,
        expiresAt: c.expiresAt,
        createdAt: c.createdAt,
      })),
    });
  }),
);

// DELETE /api/coupons/:code — joueur annule son coupon
couponRouter.delete("/:code", requireRole("PLAYER"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const coupon = await prisma.savedCoupon.findFirst({
      where: { code: req.params.code, userId: req.user!.id, status: "PENDING" },
    });
    if (!coupon) throw new AppError(404, "Coupon introuvable");

    await prisma.savedCoupon.update({
      where: { id: coupon.id },
      data:  { status: "CANCELLED" },
    });

    res.json({ success: true, message: "Coupon annulé" });
  }),
);

// ─── Route caissier ──────────────────────────────────────────────────────────

// GET /api/coupons/cashier/:code — caissier récupère un coupon
couponRouter.get("/cashier/:code", requireRole("CASHIER", "ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const coupon = await prisma.savedCoupon.findUnique({
      where: { code: req.params.code.toUpperCase() },
      include: { user: { select: { id: true, firstName: true, lastName: true, phone: true, playerNumber: true } } },
    });

    if (!coupon) throw new AppError(404, "Code coupon introuvable");
    if (coupon.status === "USED") throw new AppError(400, "Ce coupon a déjà été joué");
    if (coupon.status === "CANCELLED") throw new AppError(400, "Ce coupon a été annulé");
    if (new Date() > coupon.expiresAt) {
      await prisma.savedCoupon.update({ where: { id: coupon.id }, data: { status: "EXPIRED" } });
      throw new AppError(400, "Ce coupon a expiré (valide 48h)");
    }

    const selections = coupon.selections as any[];
    const totalOdds  = selections.reduce((acc, s) => acc * Number(s.oddValue ?? 1), 1);

    res.json({
      success: true,
      data: {
        code:          coupon.code,
        player:        coupon.user,
        selections,
        totalOdds:     Math.round(totalOdds * 100) / 100,
        suggestedStakeXAF: coupon.suggestedStake ? Number(coupon.suggestedStake) / 100 : null,
        expiresAt:     coupon.expiresAt,
      },
    });
  }),
);

// POST /api/coupons/cashier/place — caissier place le pari + génère ticket
couponRouter.post("/cashier/place", requireRole("CASHIER", "ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { code, stakeXAF, payWithCash } = req.body;
    if (!code || !stakeXAF) throw new AppError(400, "Code et mise requis");

    const stakeCentimes = BigInt(Math.round(Number(stakeXAF) * 100));
    if (stakeCentimes < BigInt(100_00)) throw new AppError(400, "Mise minimum : 100 XAF");

    const coupon = await prisma.savedCoupon.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        user: {
          include: { wallet: true },
        },
      },
    });

    if (!coupon) throw new AppError(404, "Code coupon introuvable");
    if (coupon.status !== "PENDING") throw new AppError(400, `Coupon déjà ${coupon.status.toLowerCase()}`);
    if (new Date() > coupon.expiresAt) throw new AppError(400, "Coupon expiré");
    if (!coupon.user || !coupon.user.wallet) throw new AppError(400, "Joueur sans portefeuille");

    const selections = coupon.selections as any[];
    const totalOdds  = selections.reduce((acc, s) => acc * Number(s.oddValue ?? 1), 1);
    const potentialWin = BigInt(Math.round(Number(stakeCentimes) * totalOdds));

    // Si paiement cash → créditer le wallet du joueur d'abord
    if (payWithCash) {
      await prisma.$transaction([
        prisma.wallet.update({
          where: { id: coupon.user.wallet.id },
          data:  { balance: { increment: stakeCentimes } },
        }),
        prisma.transaction.create({
          data: {
            walletId:      coupon.user.wallet.id,
            userId:        coupon.userId!,
            type:          "DEPOSIT",
            amount:        stakeCentimes,
            balanceBefore: coupon.user.wallet.balance,
            balanceAfter:  coupon.user.wallet.balance + stakeCentimes,
            status:        "COMPLETED",
            provider:      "CASH",
            metadata: {
              cashierId:   req.user!.id,
              channel:     "POS_TICKET",
              couponCode:  code,
            },
          },
        }),
        // Débiter le float caissier
        prisma.cashierWallet.upsert({
          where:  { userId: req.user!.id },
          update: { balance: { decrement: stakeCentimes } },
          create: { userId: req.user!.id, balance: -stakeCentimes },
        }),
      ]);
      // Recharger le wallet
      coupon.user.wallet.balance += stakeCentimes;
    }

    if (coupon.user.wallet.balance < stakeCentimes) {
      throw new AppError(400, "Solde insuffisant pour cette mise");
    }

    // Créer le pari
    const bet = await prisma.$transaction(async (tx) => {
      const newBet = await tx.bet.create({
        data: {
          userId:       coupon.userId!,
          type:         selections.length === 1 ? "SINGLE" : "ACCUMULATOR",
          stake:        stakeCentimes,
          totalOdds:    totalOdds,
          potentialWin: potentialWin,
          status:       "PENDING",
          items: {
            create: selections.map((s: any) => ({
              marketId: s.marketId,
              oddId:    s.oddId,
              oddValue: s.oddValue,
            })),
          },
        },
        include: { items: true },
      });

      // Débiter le wallet joueur
      await tx.wallet.update({
        where: { id: coupon.user!.wallet!.id },
        data:  { balance: { decrement: stakeCentimes } },
      });

      await tx.transaction.create({
        data: {
          walletId:      coupon.user!.wallet!.id,
          userId:        coupon.userId!,
          type:          "BET_PLACED",
          amount:        -stakeCentimes,
          balanceBefore: coupon.user!.wallet!.balance,
          balanceAfter:  coupon.user!.wallet!.balance - stakeCentimes,
          status:        "COMPLETED",
          provider:      "CASH",
          metadata:      { betId: newBet.id, couponCode: code, cashierId: req.user!.id },
        },
      });

      // Marquer le coupon comme utilisé
      await tx.savedCoupon.update({
        where: { id: coupon.id },
        data:  { status: "USED", usedAt: new Date(), betId: newBet.id },
      });

      return newBet;
    });

    // Données du ticket pour impression
    const ticket = {
      betId:         bet.id,
      ticketRef:     `TKT-${bet.id.slice(-8).toUpperCase()}`,
      code:          coupon.code,
      playerName:    `${coupon.user.firstName} ${coupon.user.lastName}`,
      playerPhone:   coupon.user.phone,
      playerNumber:  coupon.user.playerNumber,
      selections,
      totalOdds:     Math.round(totalOdds * 100) / 100,
      stakeXAF:      Number(stakeCentimes) / 100,
      potentialWinXAF: Number(potentialWin) / 100,
      placedAt:      new Date().toISOString(),
      cashierName:   req.user!.email,
    };

    res.status(201).json({ success: true, data: ticket });
  }),
);
