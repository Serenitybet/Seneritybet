import { Router, Request, Response } from "express";
import { requireRole, AuthRequest } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../lib/asyncHandler";
import { AppError } from "../../middleware/error.middleware";
import { getSetting, setSetting, SETTING_KEYS } from "../../lib/settings";

export const adminSettingsRouter = Router();

// GET /api/admin/settings/tpe-payout-threshold — seuil d'approbation des paiements TPE
adminSettingsRouter.get("/tpe-payout-threshold", asyncHandler(async (_req: Request, res: Response) => {
  const value = await getSetting(SETTING_KEYS.TPE_PAYOUT_APPROVAL_THRESHOLD_XAF);
  res.json({ success: true, data: { thresholdXAF: Number(value) / 100 } });
}));

// PATCH /api/admin/settings/tpe-payout-threshold
adminSettingsRouter.patch("/tpe-payout-threshold", requireRole("ADMIN", "SUPER_ADMIN", "FINANCE"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { thresholdXAF } = req.body;
    if (!thresholdXAF || isNaN(Number(thresholdXAF)) || Number(thresholdXAF) < 0) {
      throw new AppError(400, "Seuil invalide");
    }
    const centimes = Math.round(Number(thresholdXAF) * 100);
    await setSetting(SETTING_KEYS.TPE_PAYOUT_APPROVAL_THRESHOLD_XAF, String(centimes), req.user!.id);
    res.json({ success: true, data: { thresholdXAF: Number(thresholdXAF) } });
  }),
);

// GET /api/admin/settings/tpe-max-win — plafond de gain potentiel accepté à la prise du pari
adminSettingsRouter.get("/tpe-max-win", asyncHandler(async (_req: Request, res: Response) => {
  const value = await getSetting(SETTING_KEYS.TPE_MAX_WIN_XAF);
  res.json({ success: true, data: { maxWinXAF: Number(value) / 100 } });
}));

// PATCH /api/admin/settings/tpe-max-win — 0 = désactivé (aucun plafond)
adminSettingsRouter.patch("/tpe-max-win", requireRole("ADMIN", "SUPER_ADMIN", "FINANCE"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { maxWinXAF } = req.body;
    if (maxWinXAF === undefined || isNaN(Number(maxWinXAF)) || Number(maxWinXAF) < 0) {
      throw new AppError(400, "Plafond invalide");
    }
    const centimes = Math.round(Number(maxWinXAF) * 100);
    await setSetting(SETTING_KEYS.TPE_MAX_WIN_XAF, String(centimes), req.user!.id);
    res.json({ success: true, data: { maxWinXAF: Number(maxWinXAF) } });
  }),
);
