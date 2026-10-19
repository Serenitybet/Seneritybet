import { Router, Request, Response } from "express";
import { requireRole } from "../../middleware/auth.middleware";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { AppError } from "../../middleware/error.middleware";
import * as tpeService from "../../services/tpe.service";
import { serializeTicket } from "../../services/tpe.service";

export const adminTicketsRouter = Router();

// GET /api/admin/tickets
adminTicketsRouter.get("/", asyncHandler(async (req: Request, res: Response) => {
  const page      = parseInt((req.query.page  as string) ?? "1",  10);
  const limit     = parseInt((req.query.limit as string) ?? "100", 10);
  const status    = req.query.status as string | undefined;
  const tpeId     = req.query.tpeId as string | undefined;
  const dangerous = req.query.dangerous === "true";

  const where = {
    ...(status ? { status: status as any } : {}),
    ...(tpeId ? { tpeId } : {}),
    ...(dangerous ? { requiresApproval: true, approvedAt: null } : {}),
  };

  const [total, tickets] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      include: {
        tpe: { select: { code: true, name: true } },
        cashier: { select: { firstName: true, lastName: true } },
        items: { include: { odd: true, market: { include: { event: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.json({
    success: true,
    data: {
      tickets: tickets.map(serializeTicket),
      total, page, limit, totalPages: Math.ceil(total / limit),
    },
  });
}));

// PATCH /api/admin/tickets/:id/result — saisir le résultat d'une sélection
adminTicketsRouter.patch("/:id/result", requireRole("TRADER", "ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { itemId, result } = req.body;
    if (!["WON", "LOST", "VOID"].includes(result)) {
      throw new AppError(400, "Résultat invalide");
    }
    await prisma.ticketItem.update({ where: { id: itemId }, data: { result } });

    // Règle automatiquement le ticket dès que le dernier résultat manquant
    // vient d'être saisi — évite qu'un ticket reste bloqué "en cours" parce
    // que l'étape séparée "Régler le ticket" a été oubliée.
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    let settled: Awaited<ReturnType<typeof tpeService.settleTicket>> | null = null;
    if (ticket && ticket.status === "PENDING" && ticket.items.every((i) => i.result !== null)) {
      settled = await tpeService.settleTicket(ticket.id);
    }
    res.json({ success: true, data: { settled } });
  }),
);

// POST /api/admin/tickets/:id/settle — régler le ticket une fois tous les résultats connus
adminTicketsRouter.post("/:id/settle", requireRole("TRADER", "ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await tpeService.settleTicket(req.params.id);
    res.json({ success: true, data: result });
  }),
);

// POST /api/admin/tickets/:id/approve — débloque le paiement d'un gros gain
adminTicketsRouter.post("/:id/approve", requireRole("ADMIN", "SUPER_ADMIN", "FINANCE"),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await tpeService.approveTicket(req.params.id);
    res.json({ success: true, data: result });
  }),
);

// GET /api/admin/tickets/:id/payout-code — accès exceptionnel (ticket original illisible/perdu, bourrage papier)
adminTicketsRouter.get("/:id/payout-code", requireRole("ADMIN", "SUPER_ADMIN", "FINANCE"),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await tpeService.getTicketPayoutCode(req.params.id);
    res.json({ success: true, data: result });
  }),
);
