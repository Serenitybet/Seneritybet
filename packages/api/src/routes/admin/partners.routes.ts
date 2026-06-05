import { Router, Request, Response } from "express";
import { requireRole } from "../../middleware/auth.middleware";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";

export const adminPartnersRouter = Router();

// GET /api/admin/partners
adminPartnersRouter.get("/", asyncHandler(async (_req: Request, res: Response) => {
  const partners = await prisma.partner.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { referrals: true, commissions: true, withdrawals: true } } },
  });
  res.json({ success: true, data: partners });
}));

// PATCH /api/admin/partners/:id/status
adminPartnersRouter.patch("/:id/status", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body;
    if (!["ACTIVE", "SUSPENDED", "PENDING"].includes(status)) {
      res.status(400).json({ success: false, error: "Statut invalide" }); return;
    }
    await prisma.partner.update({ where: { id: req.params.id }, data: { status } });
    res.json({ success: true });
  }),
);

// PATCH /api/admin/partners/:id/commission
adminPartnersRouter.patch("/:id/commission", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { commissionRate } = req.body;
    if (typeof commissionRate !== "number" || commissionRate < 0 || commissionRate > 1) {
      res.status(400).json({ success: false, error: "Taux invalide (0.0 à 1.0)" }); return;
    }
    await prisma.partner.update({ where: { id: req.params.id }, data: { commissionRate } });
    res.json({ success: true });
  }),
);

// GET /api/admin/partners/withdrawals — toutes les demandes de retrait
adminPartnersRouter.get("/withdrawals", asyncHandler(async (_req: Request, res: Response) => {
  const withdrawals = await prisma.partnerWithdrawal.findMany({
    where:   { status: "PENDING" },
    include: { partner: { select: { firstName: true, lastName: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ success: true, data: withdrawals });
}));

// PATCH /api/admin/partners/withdrawals/:id
adminPartnersRouter.patch("/withdrawals/:id", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body;
    if (!["PAID", "REJECTED"].includes(status)) {
      res.status(400).json({ success: false, error: "Statut invalide" }); return;
    }
    const withdrawal = await prisma.partnerWithdrawal.findUnique({ where: { id: req.params.id } });
    if (!withdrawal) { res.status(404).json({ success: false, error: "Introuvable" }); return; }

    await prisma.$transaction([
      prisma.partnerWithdrawal.update({
        where: { id: req.params.id },
        data:  { status, processedAt: new Date() },
      }),
      // Si rejeté → rembourser le solde
      ...(status === "REJECTED" ? [
        prisma.partner.update({
          where: { id: withdrawal.partnerId },
          data:  { balance: { increment: withdrawal.amount } },
        }),
      ] : []),
    ]);

    res.json({ success: true });
  }),
);
