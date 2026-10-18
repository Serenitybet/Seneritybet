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
