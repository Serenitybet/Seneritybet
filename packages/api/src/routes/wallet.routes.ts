import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth.middleware";
import * as walletService from "../services/wallet.service";
import { asyncHandler } from "../lib/asyncHandler";

export const walletRouter = Router();
walletRouter.use(authenticate);

walletRouter.get("/", asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await walletService.getBalance(req.user!.id);
  res.json({ success: true, data });
}));

walletRouter.post("/deposit", asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await walletService.deposit(req.user!.id, req.body);
  res.status(202).json({ success: true, data: result });
}));

walletRouter.post("/withdraw", asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await walletService.withdraw(req.user!.id, req.body);
  res.status(202).json({ success: true, data: result });
}));

walletRouter.get("/transactions", asyncHandler(async (req: AuthRequest, res: Response) => {
  const page  = parseInt((req.query.page  as string) ?? "1",  10);
  const limit = parseInt((req.query.limit as string) ?? "20", 10);
  const result = await walletService.getTransactions(req.user!.id, page, Math.min(limit, 50));
  res.json({ success: true, data: result });
}));
