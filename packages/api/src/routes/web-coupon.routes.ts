import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../lib/asyncHandler";
import { AppError } from "../middleware/error.middleware";
import * as webCouponService from "../services/web-coupon.service";

// Public, sans compte — composition et consultation d'un coupon depuis le
// site web, retiré en espèces en boutique (voir tpe.routes.ts GET
// /web-coupons/:code côté caissier, et placeTicket qui le consomme).
export const webCouponRouter = Router();

// Anti brute-force sur le code de retrait à 4 chiffres (payoutCode) —
// trouvé lors de l'audit de sécurité du 04/11/2026 : cette route est
// publique et sans authentification, et n'était couverte que par la
// limite générale de l'API (300 req/15 min par IP), largement suffisante
// pour épuiser les ~9000 combinaisons possibles. La clé est le CODE du
// ticket (req.params.code), pas l'IP, pour qu'une attaque distribuée sur
// plusieurs IP ne contourne pas la limite : 10 tentatives/15 min rend
// l'attaque impraticable avant l'expiration du coupon (24h).
const cashoutAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.params.code ?? "unknown"),
  skipSuccessfulRequests: true,
  message: { success: false, error: "Trop de tentatives. Réessayez dans 15 minutes." },
});

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
webCouponRouter.post("/:code/cashout", cashoutAttemptLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { payoutCode } = req.body;
  const result = await webCouponService.requestCashoutByCode(req.params.code, payoutCode);
  res.json({ success: true, data: result });
}));
