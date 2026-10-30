import { Router, Request, Response } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { AppError } from "../middleware/error.middleware";
import * as webCouponService from "../services/web-coupon.service";

// Public, sans compte — composition et consultation d'un coupon depuis le
// site web, retiré en espèces en boutique (voir tpe.routes.ts GET
// /web-coupons/:code côté caissier, et placeTicket qui le consomme).
export const webCouponRouter = Router();

// POST /api/web-coupons — composer et enregistrer un coupon (mise suggérée optionnelle)
webCouponRouter.post("/", asyncHandler(async (req: Request, res: Response) => {
  const { selections, stakeXAF } = req.body;
  if (!Array.isArray(selections)) throw new AppError(400, "Sélections invalides");
  const result = await webCouponService.createWebCoupon(selections, stakeXAF);
  res.status(201).json({ success: true, data: result });
}));

// GET /api/web-coupons/:code — vérifier le statut d'un coupon (ou, une fois
// retiré en boutique, du ticket qu'il est devenu — inclut alors l'offre de
// cash-out courante si le ticket y est éligible)
webCouponRouter.get("/:code", asyncHandler(async (req: Request, res: Response) => {
  const result = await webCouponService.getWebCouponStatus(req.params.code);
  res.json({ success: true, data: result });
}));

// POST /api/web-coupons/:code/cashout — accepter l'offre de cash-out d'un
// ticket, par code + code de sécurité (même protection anti-fraude que le
// paiement normal en boutique)
webCouponRouter.post("/:code/cashout", asyncHandler(async (req: Request, res: Response) => {
  const { payoutCode } = req.body;
  const result = await webCouponService.requestCashoutByCode(req.params.code, payoutCode);
  res.json({ success: true, data: result });
}));
