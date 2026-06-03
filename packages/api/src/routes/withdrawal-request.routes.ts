import { Router, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { AppError } from "../middleware/error.middleware";

export const withdrawalRequestRouter = Router();

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── Routes publiques (joueur authentifié) ────────────────────────────────────
withdrawalRequestRouter.use(authenticate);

// GET /api/withdrawals/shops — liste des boutiques par ville
withdrawalRequestRouter.get("/shops", asyncHandler(async (_req, res: Response) => {
  const shops = await prisma.shop.findMany({
    where: { isActive: true },
    select: { id: true, name: true, city: true, address: true, phone: true },
    orderBy: [{ city: "asc" }, { name: "asc" }],
  });

  // Grouper par ville
  const byCity: Record<string, typeof shops> = {};
  for (const s of shops) {
    if (!byCity[s.city]) byCity[s.city] = [];
    byCity[s.city].push(s);
  }

  res.json({ success: true, data: { cities: byCity } });
}));

// POST /api/withdrawals/request — joueur crée une demande
withdrawalRequestRouter.post("/request", requireRole("PLAYER"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { shopId, amount, notes } = req.body;
    if (!shopId || !amount) throw new AppError(400, "shopId et amount sont requis");

    const amountCentimes = BigInt(Math.round(Number(amount)));
    const MIN = BigInt(100_000); // 1 000 XAF min
    const MAX = BigInt(50_000_000); // 500 000 XAF max

    if (amountCentimes < MIN) throw new AppError(400, "Montant minimum : 1 000 XAF");
    if (amountCentimes > MAX) throw new AppError(400, "Montant maximum : 500 000 XAF");

    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop || !shop.isActive) throw new AppError(404, "Boutique introuvable ou inactive");

    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user!.id } });
    if (!wallet) throw new AppError(400, "Portefeuille non initialisé");
    if (wallet.balance < amountCentimes) throw new AppError(400, "Solde insuffisant");

    // Vérifier qu'il n'y a pas déjà une demande en attente
    const existing = await prisma.withdrawalRequest.findFirst({
      where: { userId: req.user!.id, status: "PENDING" },
    });
    if (existing) throw new AppError(409, "Vous avez déjà une demande de retrait en attente");

    // Générer un code unique à 6 chiffres
    let requestCode = generateCode();
    while (await prisma.withdrawalRequest.findUnique({ where: { requestCode } })) {
      requestCode = generateCode();
    }

    // Expiration dans 24h
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Réserver le montant (déduire du solde disponible)
    const [request] = await prisma.$transaction([
      prisma.withdrawalRequest.create({
        data: {
          userId: req.user!.id,
          shopId,
          amount: amountCentimes,
          requestCode,
          expiresAt,
          notes: notes ?? null,
        },
        include: { shop: { select: { name: true, city: true, address: true } } },
      }),
      prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amountCentimes } },
      }),
    ]);

    res.status(201).json({
      success: true,
      data: {
        id: request.id,
        requestCode: request.requestCode,
        amountXAF: Number(amountCentimes) / 100,
        shop: request.shop,
        expiresAt: request.expiresAt,
        status: request.status,
      },
    });
  }),
);

// GET /api/withdrawals/my — demandes du joueur connecté
withdrawalRequestRouter.get("/my", requireRole("PLAYER"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const requests = await prisma.withdrawalRequest.findMany({
      where: { userId: req.user!.id },
      include: { shop: { select: { name: true, city: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    res.json({
      success: true,
      data: requests.map(r => ({
        id: r.id,
        requestCode: r.requestCode,
        amountXAF: Number(r.amount) / 100,
        status: r.status,
        shop: r.shop,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        completedAt: r.completedAt,
      })),
    });
  }),
);

// DELETE /api/withdrawals/:id — joueur annule sa demande
withdrawalRequestRouter.delete("/:id", requireRole("PLAYER"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const request = await prisma.withdrawalRequest.findFirst({
      where: { id: req.params.id, userId: req.user!.id, status: "PENDING" },
    });
    if (!request) throw new AppError(404, "Demande introuvable ou non annulable");

    // Rembourser le montant
    await prisma.$transaction([
      prisma.withdrawalRequest.update({
        where: { id: request.id },
        data: { status: "CANCELLED", updatedAt: new Date() },
      }),
      prisma.wallet.update({
        where: { userId: req.user!.id },
        data: { balance: { increment: request.amount } },
      }),
    ]);

    res.json({ success: true, message: "Demande annulée, montant remboursé" });
  }),
);
