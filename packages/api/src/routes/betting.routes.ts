import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth.middleware";
import * as bettingService from "../services/betting.service";
import { asyncHandler } from "../lib/asyncHandler";

export const bettingRouter = Router();
bettingRouter.use(authenticate);

bettingRouter.post("/", asyncHandler(async (req: AuthRequest, res: Response) => {
  const bet = await bettingService.placeBet(req.user!.id, req.body);
  res.status(201).json({ success: true, data: bet });
}));

// GET /bets ou /bets/my — paris de l'utilisateur connecté
const getUserBetsHandler = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page  = parseInt((req.query.page  as string) ?? "1",  10);
  const limit = parseInt((req.query.limit as string) ?? "20", 10);
  const result = await bettingService.getUserBets(req.user!.id, page, Math.min(limit, 50));
  res.json({ success: true, data: result });
});

bettingRouter.get("/",    getUserBetsHandler);
bettingRouter.get("/my",  getUserBetsHandler);  // alias utilisé par le frontend

bettingRouter.get("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await bettingService.getUserBets(req.user!.id, 1, 1);
  const bet = (result as any).bets?.find((b: any) => b.id === req.params.id);
  if (!bet) { res.status(404).json({ success: false, error: "Pari introuvable" }); return; }
  res.json({ success: true, data: bet });
}));
