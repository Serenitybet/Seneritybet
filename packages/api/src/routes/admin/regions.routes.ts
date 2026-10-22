import { Router, Request, Response } from "express";
import { requireRole, AuthRequest } from "../../middleware/auth.middleware";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { AppError } from "../../middleware/error.middleware";
import type { Region } from "@serenitybet/db";

export const adminRegionsRouter = Router();

function serializeRegion(region: Region & { _count?: { tpes: number } }) {
  const { maxWinXAF, _count, ...rest } = region;
  return {
    ...rest,
    maxWinXAF: maxWinXAF != null ? Number(maxWinXAF) / 100 : null,
    tpeCount: _count?.tpes ?? 0,
  };
}

// GET /api/admin/regions — liste des régions (avec nombre de TPE rattachés)
adminRegionsRouter.get("/", asyncHandler(async (_req: Request, res: Response) => {
  const regions = await prisma.region.findMany({
    include: { _count: { select: { tpes: true } } },
    orderBy: { name: "asc" },
  });
  res.json({ success: true, data: regions.map(serializeRegion) });
}));

// POST /api/admin/regions — créer une région
adminRegionsRouter.post("/", requireRole("ADMIN", "SUPER_ADMIN", "FINANCE"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, maxWinXAF } = req.body;
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (!trimmed) throw new AppError(400, "Nom de région requis");
    if (maxWinXAF !== undefined && maxWinXAF !== null && (isNaN(Number(maxWinXAF)) || Number(maxWinXAF) < 0)) {
      throw new AppError(400, "Plafond invalide");
    }

    const existing = await prisma.region.findUnique({ where: { name: trimmed } });
    if (existing) throw new AppError(400, "Une région porte déjà ce nom");

    const region = await prisma.region.create({
      data: {
        name: trimmed,
        maxWinXAF: maxWinXAF !== undefined && maxWinXAF !== null ? BigInt(Math.round(Number(maxWinXAF) * 100)) : null,
      },
      include: { _count: { select: { tpes: true } } },
    });
    res.status(201).json({ success: true, data: serializeRegion(region) });
  }),
);

// PATCH /api/admin/regions/:id — renommer et/ou changer le plafond de gain
// (maxWinXAF: null explicite = redevient hérité du plafond global ; omis = inchangé)
adminRegionsRouter.patch("/:id", requireRole("ADMIN", "SUPER_ADMIN", "FINANCE"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, maxWinXAF } = req.body;
    const region = await prisma.region.findUnique({ where: { id: req.params.id } });
    if (!region) throw new AppError(404, "Région introuvable");

    const data: { name?: string; maxWinXAF?: bigint | null } = {};

    if (name !== undefined) {
      const trimmed = typeof name === "string" ? name.trim() : "";
      if (!trimmed) throw new AppError(400, "Nom de région requis");
      if (trimmed !== region.name) {
        const existing = await prisma.region.findUnique({ where: { name: trimmed } });
        if (existing) throw new AppError(400, "Une région porte déjà ce nom");
      }
      data.name = trimmed;
    }

    if (maxWinXAF !== undefined) {
      if (maxWinXAF === null) {
        data.maxWinXAF = null;
      } else {
        if (isNaN(Number(maxWinXAF)) || Number(maxWinXAF) < 0) throw new AppError(400, "Plafond invalide");
        data.maxWinXAF = BigInt(Math.round(Number(maxWinXAF) * 100));
      }
    }

    const updated = await prisma.region.update({
      where: { id: region.id },
      data,
      include: { _count: { select: { tpes: true } } },
    });
    res.json({ success: true, data: serializeRegion(updated) });
  }),
);

// DELETE /api/admin/regions/:id — bloqué si des TPE y sont encore rattachés
// (évite qu'une suppression réinitialise silencieusement leur plafond)
adminRegionsRouter.delete("/:id", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const count = await prisma.tpe.count({ where: { regionId: req.params.id } });
    if (count > 0) {
      throw new AppError(400, `Impossible de supprimer : ${count} terminal(aux) encore rattaché(s) à cette région`);
    }
    await prisma.region.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Région supprimée" });
  }),
);
