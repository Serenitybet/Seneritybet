import { Router, Request, Response } from "express";
import { requireRole } from "../../middleware/auth.middleware";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";

export const adminShopsRouter = Router();

// GET /api/admin/shops
adminShopsRouter.get("/", asyncHandler(async (_req: Request, res: Response) => {
  const shops = await prisma.shop.findMany({
    orderBy: [{ city: "asc" }, { name: "asc" }],
    include: { _count: { select: { withdrawalRequests: true } } },
  });
  res.json({ success: true, data: shops });
}));

// POST /api/admin/shops
adminShopsRouter.post("/", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, city, address, phone } = req.body;
    if (!name || !city) {
      res.status(400).json({ success: false, error: "Nom et ville requis" }); return;
    }
    const shop = await prisma.shop.create({
      data: { name: name.trim(), city: city.trim(), address: address?.trim() ?? null, phone: phone?.trim() ?? null },
    });
    res.status(201).json({ success: true, data: shop });
  }),
);

// PATCH /api/admin/shops/:id
adminShopsRouter.patch("/:id", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, city, address, phone, isActive } = req.body;
    const shop = await prisma.shop.update({
      where: { id: req.params.id },
      data: {
        ...(name     !== undefined ? { name: name.trim() }         : {}),
        ...(city     !== undefined ? { city: city.trim() }         : {}),
        ...(address  !== undefined ? { address: address?.trim() }  : {}),
        ...(phone    !== undefined ? { phone: phone?.trim() }      : {}),
        ...(isActive !== undefined ? { isActive }                  : {}),
      },
    });
    res.json({ success: true, data: shop });
  }),
);

// DELETE /api/admin/shops/:id (désactivation)
adminShopsRouter.delete("/:id", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.shop.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ success: true, message: "Boutique désactivée" });
  }),
);
