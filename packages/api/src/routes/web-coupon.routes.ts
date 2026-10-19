import { Router, Request, Response } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { AppError } from "../middleware/error.middleware";
import * as webCouponService from "../services/web-coupon.service";

// Public, sans compte — composition et consultation d'un coupon depuis le
// site web, retiré en espèces en boutique (voir tpe.routes.ts GET
// /web-coupons/:code côté caissier, et placeTicket qui le consomme).
export const webCouponRouter = Router();

// POST /api/web-coupons — composer et enregistrer un coupon
webCouponRouter.post("/", asyncHandler(async (req: Request, res: Response) => {
  const { selections } = req.body;
  if (!Array.isArray(selections)) throw new AppError(400, "Sélections invalides");
  const result = await webCouponService.createWebCoupon(selections);
  res.status(201).json({ success: true, data: result });
}));

// GET /api/web-coupons/:code — vérifier le statut d'un coupon (ou, une fois
// retiré en boutique, du ticket qu'il est devenu)
webCouponRouter.get("/:code", asyncHandler(async (req: Request, res: Response) => {
  const result = await webCouponService.getWebCouponStatus(req.params.code);
  res.json({ success: true, data: result });
}));
