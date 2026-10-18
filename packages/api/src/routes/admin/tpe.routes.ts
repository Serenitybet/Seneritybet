import { Router, Request, Response } from "express";
import { requireRole, AuthRequest } from "../../middleware/auth.middleware";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { AppError } from "../../middleware/error.middleware";
import { serializeTpe, serializeTicket, serializeCreditAdjustment } from "../../services/tpe.service";

export const adminTpeRouter = Router();

// GET /api/admin/tpe — liste des TPE
adminTpeRouter.get("/", asyncHandler(async (_req: Request, res: Response) => {
  const tpes = await prisma.tpe.findMany({
    where: { status: { not: "DELETED" } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ success: true, data: tpes.map(serializeTpe) });
}));

// GET /api/admin/tpe/payouts/pending — paiements au-dessus du seuil en attente d'approbation
adminTpeRouter.get("/payouts/pending", asyncHandler(async (_req: Request, res: Response) => {
  const tickets = await prisma.ticket.findMany({
    where: { status: "WON", requiresApproval: true, approvedAt: null },
    include: { tpe: { select: { code: true, name: true } } },
    orderBy: { settledAt: "asc" },
  });
  res.json({ success: true, data: tickets.map(serializeTicket) });
}));

// POST /api/admin/tpe/payouts/:ticketId/approve
adminTpeRouter.post("/payouts/:ticketId/approve", requireRole("ADMIN", "SUPER_ADMIN", "FINANCE"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.ticketId } });
    if (!ticket) throw new AppError(404, "Ticket introuvable");
    if (!ticket.requiresApproval || ticket.approvedAt) throw new AppError(400, "Rien à approuver pour ce ticket");

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { approvedAt: new Date(), approvedBy: req.user!.id },
    });
    res.json({ success: true, data: serializeTicket(updated) });
  }),
);

// POST /api/admin/tpe/payouts/:ticketId/reject
adminTpeRouter.post("/payouts/:ticketId/reject", requireRole("ADMIN", "SUPER_ADMIN", "FINANCE"),
  asyncHandler(async (req: Request, res: Response) => {
    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.ticketId } });
    if (!ticket) throw new AppError(404, "Ticket introuvable");
    if (!ticket.requiresApproval || ticket.approvedAt) throw new AppError(400, "Rien à rejeter pour ce ticket");

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: "CANCELLED" },
    });
    res.json({ success: true, data: serializeTicket(updated) });
  }),
);

// POST /api/admin/tpe/:id/approve — valider l'appairage d'un nouveau TPE
adminTpeRouter.post("/:id/approve", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.body;
    const tpe = await prisma.tpe.findUnique({ where: { id: req.params.id } });
    if (!tpe) throw new AppError(404, "TPE introuvable");
    if (tpe.status !== "PENDING_PAIRING") throw new AppError(400, "Ce TPE n'est pas en attente d'appairage");

    const updated = await prisma.tpe.update({
      where: { id: tpe.id },
      data: { status: "ACTIVE", pairedAt: new Date(), name: name?.trim() || tpe.name },
    });
    res.json({ success: true, data: serializeTpe(updated) });
  }),
);

// PATCH /api/admin/tpe/:id — renommer
adminTpeRouter.patch("/:id", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.body;
    const trimmed = typeof name === "string" ? name.trim() : null;
    const tpe = await prisma.tpe.update({
      where: { id: req.params.id },
      data: { ...(name !== undefined ? { name: trimmed || null } : {}) },
    });
    res.json({ success: true, data: serializeTpe(tpe) });
  }),
);

// POST /api/admin/tpe/:id/credit — ajuster le crédit (recharge ou retrait)
adminTpeRouter.post("/:id/credit", requireRole("ADMIN", "SUPER_ADMIN", "FINANCE"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { amountXAF, reason } = req.body;
    if (!amountXAF || isNaN(Number(amountXAF))) throw new AppError(400, "Montant invalide");
    const amount = BigInt(Math.round(Number(amountXAF) * 100));

    const tpe = await prisma.tpe.findUnique({ where: { id: req.params.id } });
    if (!tpe) throw new AppError(404, "TPE introuvable");
    if (tpe.status === "DELETED") throw new AppError(400, "Ce TPE est supprimé");
    if (tpe.credit + amount < BigInt(0)) throw new AppError(400, "Le crédit ne peut pas devenir négatif");

    const [updated] = await prisma.$transaction([
      prisma.tpe.update({ where: { id: tpe.id }, data: { credit: { increment: amount } } }),
      prisma.tpeCreditAdjustment.create({
        data: { tpeId: tpe.id, amount, reason: reason?.trim() || null, adminId: req.user!.id },
      }),
    ]);
    res.json({ success: true, data: serializeTpe(updated) });
  }),
);

// GET /api/admin/tpe/:id/credit-history — historique des ajustements de crédit
adminTpeRouter.get("/:id/credit-history", asyncHandler(async (req: Request, res: Response) => {
  const history = await prisma.tpeCreditAdjustment.findMany({
    where: { tpeId: req.params.id },
    include: { admin: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json({ success: true, data: history.map(serializeCreditAdjustment) });
}));

// POST /api/admin/tpe/:id/block
adminTpeRouter.post("/:id/block", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const tpe = await prisma.tpe.update({ where: { id: req.params.id }, data: { status: "BLOCKED" } });
    res.json({ success: true, data: serializeTpe(tpe) });
  }),
);

// POST /api/admin/tpe/:id/unblock
adminTpeRouter.post("/:id/unblock", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const tpe = await prisma.tpe.findUnique({ where: { id: req.params.id } });
    if (!tpe) throw new AppError(404, "TPE introuvable");
    if (tpe.status !== "BLOCKED") throw new AppError(400, "Ce TPE n'est pas bloqué");
    const updated = await prisma.tpe.update({ where: { id: tpe.id }, data: { status: "ACTIVE" } });
    res.json({ success: true, data: serializeTpe(updated) });
  }),
);

// DELETE /api/admin/tpe/:id — suppression (douce, conserve l'historique des tickets)
adminTpeRouter.delete("/:id", requireRole("SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.tpe.update({ where: { id: req.params.id }, data: { status: "DELETED" } });
    res.json({ success: true, message: "TPE supprimé" });
  }),
);
