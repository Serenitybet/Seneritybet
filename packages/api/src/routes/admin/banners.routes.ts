import { Router, Request, Response } from "express";
import { requireRole } from "../../middleware/auth.middleware";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { AppError } from "../../middleware/error.middleware";

export const adminBannersRouter = Router();

// GET /api/admin/banners — toutes les bannières (actives ou non)
adminBannersRouter.get("/", asyncHandler(async (_req: Request, res: Response) => {
  const banners = await prisma.promoBanner.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  res.json({ success: true, data: banners });
}));

// POST /api/admin/banners
adminBannersRouter.post("/", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { imageUrl, title, subtitle, linkUrl, sortOrder, isActive } = req.body;
    if (!imageUrl?.trim()) throw new AppError(400, "URL de l'image requise");
    const banner = await prisma.promoBanner.create({
      data: {
        imageUrl: imageUrl.trim(),
        title: title?.trim() || null,
        subtitle: subtitle?.trim() || null,
        linkUrl: linkUrl?.trim() || null,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
        isActive: isActive ?? true,
      },
    });
    res.status(201).json({ success: true, data: banner });
  }),
);

// PATCH /api/admin/banners/:id
adminBannersRouter.patch("/:id", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { imageUrl, title, subtitle, linkUrl, sortOrder, isActive } = req.body;
    const banner = await prisma.promoBanner.update({
      where: { id: req.params.id },
      data: {
        ...(imageUrl  !== undefined ? { imageUrl: imageUrl.trim() } : {}),
        ...(title     !== undefined ? { title: title?.trim() || null } : {}),
        ...(subtitle  !== undefined ? { subtitle: subtitle?.trim() || null } : {}),
        ...(linkUrl   !== undefined ? { linkUrl: linkUrl?.trim() || null } : {}),
        ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
        ...(isActive  !== undefined ? { isActive } : {}),
      },
    });
    res.json({ success: true, data: banner });
  }),
);

// DELETE /api/admin/banners/:id
adminBannersRouter.delete("/:id", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.promoBanner.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Bannière supprimée" });
  }),
);
