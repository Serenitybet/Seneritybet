import { Router, Request, Response } from "express";
import { requireRole } from "../../middleware/auth.middleware";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";

export const adminShopsRouter = Router();

// GET /api/admin/shops
adminShopsRouter.get("/", asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = req.query;

  const dateFilter = (from || to) ? {
    completedAt: {
      ...(from ? { gte: new Date(from as string) } : {}),
      ...(to   ? { lte: new Date(to   as string) } : {}),
    },
  } : {};

  const shops = await prisma.shop.findMany({
    orderBy: [{ city: "asc" }, { name: "asc" }],
  });

  // Stats de retraits validés par boutique
  const withdrawalStats = await prisma.withdrawalRequest.groupBy({
    by: ["shopId"],
    where: { status: "VALIDATED", ...dateFilter },
    _sum:   { amount: true },
    _count: { id: true },
  });

  // Stats de retraits en attente par boutique
  const pendingStats = await prisma.withdrawalRequest.groupBy({
    by: ["shopId"],
    where: { status: "PENDING" },
    _sum:   { amount: true },
    _count: { id: true },
  });

  // Dépôts cash par boutique (via metadata.shopId dans les transactions POS)
  const cashDeposits = await prisma.transaction.findMany({
    where: {
      type: "DEPOSIT",
      provider: "CASH",
      status: "COMPLETED",
      ...(from || to ? {
        createdAt: {
          ...(from ? { gte: new Date(from as string) } : {}),
          ...(to   ? { lte: new Date(to   as string) } : {}),
        },
      } : {}),
    },
    select: { amount: true, metadata: true },
  });

  // Agréger les dépôts par shopId (stocké dans metadata.shopId)
  const depositByShop: Record<string, { total: bigint; count: number }> = {};
  for (const tx of cashDeposits) {
    const meta = tx.metadata as Record<string, unknown> | null;
    const shopId = meta?.shopId as string | null;
    if (shopId) {
      if (!depositByShop[shopId]) depositByShop[shopId] = { total: BigInt(0), count: 0 };
      depositByShop[shopId].total += tx.amount;
      depositByShop[shopId].count += 1;
    }
  }

  const withdrawalMap = Object.fromEntries(withdrawalStats.map(s => [s.shopId, s]));
  const pendingMap    = Object.fromEntries(pendingStats.map(p => [p.shopId, p]));

  const data = shops.map(shop => {
    const totalDepositsXAF    = Number(depositByShop[shop.id]?.total ?? 0) / 100;
    const totalWithdrawalsXAF = Number(withdrawalMap[shop.id]?._sum?.amount ?? 0) / 100;
    const pendingAmountXAF    = Number(pendingMap[shop.id]?._sum?.amount ?? 0) / 100;

    return {
      ...shop,
      stats: {
        totalDepositsXAF,
        countDeposits:       depositByShop[shop.id]?.count ?? 0,
        totalWithdrawalsXAF,
        countWithdrawals:    withdrawalMap[shop.id]?._count?.id ?? 0,
        pendingAmountXAF,
        countPending:        pendingMap[shop.id]?._count?.id ?? 0,
        balanceXAF:          totalDepositsXAF - totalWithdrawalsXAF,
      },
    };
  });

  res.json({ success: true, data });
}));

// POST /api/admin/shops
adminShopsRouter.post("/", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, city, address, phone } = req.body;
    if (!name || !city) {
      res.status(400).json({ success: false, error: "Nom et ville requis" }); return;
    }
    const shop = await prisma.shop.create({
      data: { name: name.trim(), city: city.trim(), address: address?.trim() ?? null, phone: phone?.trim() ?? null },
    });
    res.status(201).json({ success: true, data: shop });
  }),
);

// PATCH /api/admin/shops/:id
adminShopsRouter.patch("/:id", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, city, address, phone, isActive } = req.body;
    const shop = await prisma.shop.update({
      where: { id: req.params.id },
      data: {
        ...(name     !== undefined ? { name: name.trim() }         : {}),
        ...(city     !== undefined ? { city: city.trim() }         : {}),
        ...(address  !== undefined ? { address: address?.trim() }  : {}),
        ...(phone    !== undefined ? { phone: phone?.trim() }      : {}),
        ...(isActive !== undefined ? { isActive }                  : {}),
      },
    });
    res.json({ success: true, data: shop });
  }),
);

// DELETE /api/admin/shops/:id (désactivation)
adminShopsRouter.delete("/:id", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.shop.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ success: true, message: "Boutique désactivée" });
  }),
);
