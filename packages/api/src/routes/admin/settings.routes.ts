import { Router, Request, Response } from "express";
import { requireRole, AuthRequest } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../lib/asyncHandler";
import { AppError } from "../../middleware/error.middleware";
import { getSetting, getSettingFloat, getSettingNumber, setSetting, SETTING_KEYS } from "../../lib/settings";

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

// GET /api/admin/settings/cashout — paramètres du cash-out (marge + cote max sélections à venir + sélections à venir max + sélections totales min)
adminSettingsRouter.get("/cashout", asyncHandler(async (_req: Request, res: Response) => {
  const [marginPct, maxOddPending, maxPendingLegs, minTotalLegs] = await Promise.all([
    getSettingFloat(SETTING_KEYS.CASHOUT_MARGIN_PCT),
    getSettingFloat(SETTING_KEYS.CASHOUT_MAX_ODD_PENDING),
    getSettingNumber(SETTING_KEYS.CASHOUT_MAX_PENDING_LEGS),
    getSettingNumber(SETTING_KEYS.CASHOUT_MIN_TOTAL_LEGS),
  ]);
  res.json({ success: true, data: { marginPct, maxOddPending, maxPendingLegs, minTotalLegs } });
}));

// PATCH /api/admin/settings/cashout
adminSettingsRouter.patch("/cashout", requireRole("ADMIN", "SUPER_ADMIN", "FINANCE"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { marginPct, maxOddPending, maxPendingLegs, minTotalLegs } = req.body;
    if (marginPct === undefined || isNaN(Number(marginPct)) || Number(marginPct) < 0 || Number(marginPct) > 100) {
      throw new AppError(400, "Marge invalide (0 à 100)");
    }
    if (maxOddPending === undefined || isNaN(Number(maxOddPending)) || Number(maxOddPending) < 1.01) {
      throw new AppError(400, "Cote maximum invalide (min 1.01)");
    }
    if (maxPendingLegs === undefined || !Number.isInteger(Number(maxPendingLegs)) || Number(maxPendingLegs) < 0) {
      throw new AppError(400, "Nombre maximum de sélections à venir invalide (entier >= 0)");
    }
    if (minTotalLegs === undefined || !Number.isInteger(Number(minTotalLegs)) || Number(minTotalLegs) < 1) {
      throw new AppError(400, "Nombre minimum de sélections invalide (entier >= 1)");
    }
    await setSetting(SETTING_KEYS.CASHOUT_MARGIN_PCT, String(Number(marginPct)), req.user!.id);
    await setSetting(SETTING_KEYS.CASHOUT_MAX_ODD_PENDING, String(Number(maxOddPending)), req.user!.id);
    await setSetting(SETTING_KEYS.CASHOUT_MAX_PENDING_LEGS, String(Number(maxPendingLegs)), req.user!.id);
    await setSetting(SETTING_KEYS.CASHOUT_MIN_TOTAL_LEGS, String(Number(minTotalLegs)), req.user!.id);
    res.json({ success: true, data: { marginPct: Number(marginPct), maxOddPending: Number(maxOddPending), maxPendingLegs: Number(maxPendingLegs), minTotalLegs: Number(minTotalLegs) } });
  }),
);
