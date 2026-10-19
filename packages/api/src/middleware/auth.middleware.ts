import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { Role } from "@serenitybet/db";

export interface AuthRequest extends Request {
  user?: { id: string; role: Role; email: string; shopId?: string | null };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "Token manquant" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      sub: string;
      role: Role;
      email: string;
      iat: number;
    };

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, email: true, status: true, shopId: true, tokensRevokedAt: true },
    });

    if (!user || user.status !== "ACTIVE") {
      res.status(401).json({ success: false, error: "Compte inactif ou inexistant" });
      return;
    }

    // Un token émis avant la dernière déconnexion (voir logout()) n'est plus
    // valable, même s'il n'a pas encore expiré naturellement.
    if (user.tokensRevokedAt && payload.iat * 1000 < user.tokensRevokedAt.getTime()) {
      res.status(401).json({ success: false, error: "Session expirée — reconnectez-vous" });
      return;
    }

    req.user = { id: user.id, role: user.role, email: user.email, shopId: user.shopId };
    next();
  } catch {
    res.status(401).json({ success: false, error: "Token invalide ou expiré" });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: "Accès refusé" });
      return;
    }
    next();
  };
}
