import crypto from "crypto";
import { Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import type { Tpe } from "@serenitybet/db";
import type { AuthRequest } from "./auth.middleware";

export interface TpeRequest extends AuthRequest {
  tpe?: Tpe;
}

export function hashDeviceSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

/** Identifie le TPE à partir du secret d'appareil, sans exiger qu'il soit déjà actif. */
export async function identifyTpeDevice(req: TpeRequest, res: Response, next: NextFunction) {
  const secret = req.headers["x-tpe-secret"];
  if (!secret || typeof secret !== "string") {
    res.status(401).json({ success: false, error: "Secret d'appareil manquant" });
    return;
  }

  const tpe = await prisma.tpe.findUnique({ where: { deviceSecretHash: hashDeviceSecret(secret) } });
  if (!tpe) {
    res.status(401).json({ success: false, error: "Appareil inconnu — réinitialisez l'appairage" });
    return;
  }
  if (tpe.status === "DELETED") {
    res.status(403).json({ success: false, error: "Ce TPE a été supprimé" });
    return;
  }

  req.tpe = tpe;
  prisma.tpe.update({ where: { id: tpe.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  next();
}

/** Exige un TPE actif (appairé et non bloqué) — à utiliser après identifyTpeDevice. */
export function requireActiveTpe(req: TpeRequest, res: Response, next: NextFunction) {
  if (!req.tpe) {
    res.status(401).json({ success: false, error: "Appareil non identifié" });
    return;
  }
  if (req.tpe.status === "PENDING_PAIRING") {
    res.status(403).json({ success: false, error: "TPE en attente de validation par le backoffice" });
    return;
  }
  if (req.tpe.status === "BLOCKED") {
    res.status(403).json({ success: false, error: "Ce TPE est bloqué — contactez le backoffice" });
    return;
  }
  next();
}

/**
 * Exige que le caissier connecté soit autorisé sur ce TPE précis — demande
 * explicite du 31/10/2026 : un caissier ne doit plus pouvoir se connecter
 * sur n'importe quel TPE. À utiliser après identifyTpeDevice/requireActiveTpe
 * ET authenticate (dans cet ordre — a besoin de req.tpe et req.user).
 *
 * Tant qu'AUCUN caissier n'est explicitement assigné à ce TPE, l'accès reste
 * libre (comportement historique) : la restriction est donc opt-in, TPE par
 * TPE, pour ne pas bloquer d'un coup tous les TPE déjà en service tant qu'un
 * admin n'a pas configuré leurs rattachements. ADMIN/SUPER_ADMIN passent
 * toujours (ils n'opèrent pas une caisse au quotidien, et doivent pouvoir
 * dépanner n'importe quel TPE).
 */
export async function requireCashierAssignedToTpe(req: TpeRequest, res: Response, next: NextFunction) {
  if (!req.tpe || !req.user) {
    res.status(401).json({ success: false, error: "Non authentifié" });
    return;
  }
  if (req.user.role === "ADMIN" || req.user.role === "SUPER_ADMIN") {
    next();
    return;
  }

  const assignedCount = await prisma.tpeCashier.count({ where: { tpeId: req.tpe.id } });
  if (assignedCount === 0) {
    next();
    return;
  }

  const allowed = await prisma.tpeCashier.findUnique({
    where: { tpeId_cashierId: { tpeId: req.tpe.id, cashierId: req.user.id } },
  });
  if (!allowed) {
    res.status(403).json({
      success: false,
      error: "Ce caissier n'est pas autorisé sur ce TPE — contactez le backoffice",
      data: { code: "CASHIER_NOT_ASSIGNED" },
    });
    return;
  }
  next();
}
