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
  const page   = parseInt((req.query.page  as string) ?? "1",  10);
  const limit  = parseInt((req.query.limit as string) ?? "25", 10);
  const status = req.query.status as string | undefined;

  const where = status ? { status: status as any } : {};

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
    res.json({ success: true });
  }),
);

// POST /api/admin/tickets/:id/settle — régler le ticket une fois tous les résultats connus
adminTicketsRouter.post("/:id/settle", requireRole("TRADER", "ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await tpeService.settleTicket(req.params.id);
    res.json({ success: true, data: result });
  }),
);
