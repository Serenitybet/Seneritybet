import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";

// Public — carrousel promotionnel de la page d'accueil (apps/web).
export const bannersRouter = Router();

bannersRouter.get("/", asyncHandler(async (_req: Request, res: Response) => {
  const banners = await prisma.promoBanner.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  res.json({ success: true, data: banners });
}));
