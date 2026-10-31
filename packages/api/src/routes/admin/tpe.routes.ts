import { Router, Request, Response } from "express";
import { requireRole, AuthRequest } from "../../middleware/auth.middleware";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { AppError } from "../../middleware/error.middleware";
import { serializeTpe, serializeTicket, serializeCreditAdjustment, getTpeSummaryReport } from "../../services/tpe.service";

export const adminTpeRouter = Router();

// GET /api/admin/tpe — liste des TPE
adminTpeRouter.get("/", asyncHandler(async (_req: Request, res: Response) => {
  const tpes = await prisma.tpe.findMany({
    where: { status: { not: "DELETED" } },
    include: {
      region: { select: { id: true, name: true } },
      _count: { select: { assignedCashiers: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ success: true, data: tpes.map((t: typeof tpes[number]) => ({ ...serializeTpe(t), assignedCashiersCount: t._count.assignedCashiers })) });
}));

// GET /api/admin/tpe/reports/summary — rapport consolidé (ventes/tickets/
// paiements, une ligne par TPE) sur une période, tous TPE confondus
adminTpeRouter.get("/reports/summary", asyncHandler(async (req: Request, res: Response) => {
  const now = new Date();
  const defaultFrom = new Date(now); defaultFrom.setDate(now.getDate() - 6); defaultFrom.setHours(0, 0, 0, 0);
  // "YYYY-MM-DD" tel quel (sans heure) est interprété comme minuit UTC — pour
  // "to", ça tombe au tout DÉBUT du jour demandé plutôt qu'à sa fin, donc la
  // fenêtre ne couvrait presque aucune donnée (signalé en prod le
  // 31/10/2026 : rapport du jour vide alors que des tickets avaient été
  // vendus). Même correctif déjà appliqué à la liste des tickets TPE
  // (admin/tickets.routes.ts) : ancrer explicitement "from" à 00:00:00 et
  // "to" à 23:59:59.999 du jour indiqué.
  const fromStr = req.query.from as string | undefined;
  const toStr   = req.query.to   as string | undefined;
  const from = fromStr ? new Date(`${fromStr}T00:00:00`) : defaultFrom;
  const to   = toStr   ? new Date(`${toStr}T23:59:59.999`) : now;
  const result = await getTpeSummaryReport(from, to);
  res.json({ success: true, data: result });
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

// PATCH /api/admin/tpe/:id — renommer, assigner à une région et/ou définir le palier journalier
// (regionId/dailyCreditXAF: null explicite = retire/désactive ; omis = inchangé)
adminTpeRouter.patch("/:id", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, regionId, dailyCreditXAF } = req.body;
    const trimmed = typeof name === "string" ? name.trim() : null;

    if (regionId !== undefined && regionId !== null) {
      const region = await prisma.region.findUnique({ where: { id: regionId } });
      if (!region) throw new AppError(400, "Région introuvable");
    }

    let dailyCreditCents: bigint | null | undefined;
    if (dailyCreditXAF === null) {
      dailyCreditCents = null;
    } else if (dailyCreditXAF !== undefined) {
      if (isNaN(Number(dailyCreditXAF)) || Number(dailyCreditXAF) < 0) {
        throw new AppError(400, "Palier journalier invalide");
      }
      dailyCreditCents = BigInt(Math.round(Number(dailyCreditXAF) * 100));
    }

    const tpe = await prisma.tpe.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name: trimmed || null } : {}),
        ...(regionId !== undefined ? { regionId } : {}),
        ...(dailyCreditCents !== undefined ? { dailyCreditXAF: dailyCreditCents } : {}),
      },
      include: { region: { select: { id: true, name: true } } },
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

// GET /api/admin/tpe/:id/cashiers — caissiers rattachés à ce TPE
// (liste vide = accès libre pour tout caissier, voir requireCashierAssignedToTpe)
adminTpeRouter.get("/:id/cashiers", asyncHandler(async (req: Request, res: Response) => {
  const assignments = await prisma.tpeCashier.findMany({
    where: { tpeId: req.params.id },
    include: { cashier: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json({ success: true, data: assignments.map((a: typeof assignments[number]) => ({ assignmentId: a.id, ...a.cashier })) });
}));

// POST /api/admin/tpe/:id/cashiers — rattacher un caissier à ce TPE
adminTpeRouter.post("/:id/cashiers", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { cashierId } = req.body;
    if (!cashierId) throw new AppError(400, "Caissier requis");

    const [tpe, cashier] = await Promise.all([
      prisma.tpe.findUnique({ where: { id: req.params.id } }),
      prisma.user.findUnique({ where: { id: cashierId } }),
    ]);
    if (!tpe) throw new AppError(404, "TPE introuvable");
    if (!cashier || cashier.role !== "CASHIER") throw new AppError(400, "Ce compte n'est pas un caissier");

    await prisma.tpeCashier.upsert({
      where: { tpeId_cashierId: { tpeId: tpe.id, cashierId } },
      create: { tpeId: tpe.id, cashierId },
      update: {},
    });
    res.status(201).json({ success: true, message: "Caissier rattaché" });
  }),
);

// DELETE /api/admin/tpe/:id/cashiers/:cashierId — détacher un caissier de ce TPE
adminTpeRouter.delete("/:id/cashiers/:cashierId", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.tpeCashier.deleteMany({ where: { tpeId: req.params.id, cashierId: req.params.cashierId } });
    res.json({ success: true, message: "Caissier détaché" });
  }),
);

// DELETE /api/admin/tpe/:id — suppression (douce, conserve l'historique des tickets)
adminTpeRouter.delete("/:id", requireRole("SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.tpe.update({ where: { id: req.params.id }, data: { status: "DELETED" } });
    res.json({ success: true, message: "TPE supprimé" });
  }),
);
