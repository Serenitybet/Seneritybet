import { Response } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { identifyTpeDevice, requireActiveTpe, TpeRequest } from "../middleware/tpe.middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { AppError } from "../middleware/error.middleware";
import { Router } from "express";
import * as tpeService from "../services/tpe.service";

export const tpeRouter = Router();

// Double authentification : l'appareil (secret TPE) puis l'opérateur (JWT caissier)
tpeRouter.use(identifyTpeDevice);
tpeRouter.use(requireActiveTpe);
tpeRouter.use(authenticate);
tpeRouter.use(requireRole("CASHIER", "ADMIN", "SUPER_ADMIN"));

// POST /api/tpe/tickets — créer un ticket physique anonyme
tpeRouter.post("/tickets", asyncHandler(async (req: TpeRequest, res: Response) => {
  const { selections, stakeXAF } = req.body;
  if (!stakeXAF) throw new AppError(400, "Mise requise");
  const ticket = await tpeService.placeTicket(req.tpe!.id, req.user!.id, selections, Number(stakeXAF));
  res.status(201).json({ success: true, data: ticket });
}));

// GET /api/tpe/tickets — historique des tickets créés sur ce TPE
tpeRouter.get("/tickets", asyncHandler(async (req: TpeRequest, res: Response) => {
  const page  = parseInt((req.query.page  as string) ?? "1",  10);
  const limit = parseInt((req.query.limit as string) ?? "25", 10);
  const result = await tpeService.listTicketsForTpe(req.tpe!.id, page, Math.min(limit, 100));
  res.json({ success: true, data: result });
}));

// GET /api/tpe/tickets/:code — consulter un ticket (encaissement, vérification)
tpeRouter.get("/tickets/:code", asyncHandler(async (req: TpeRequest, res: Response) => {
  const ticket = await tpeService.getTicketByCode(req.params.code);
  res.json({ success: true, data: ticket });
}));

// POST /api/tpe/tickets/:code/pay — encaisser un ticket gagnant/remboursé
tpeRouter.post("/tickets/:code/pay", asyncHandler(async (req: TpeRequest, res: Response) => {
  const result = await tpeService.payTicket(req.params.code, req.tpe!.id, req.user!.id);
  res.json({ success: true, data: result });
}));
