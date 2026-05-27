import { Router, Request, Response } from "express";
import { requireRole } from "../../middleware/auth.middleware";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";

export const adminUsersRouter = Router();

adminUsersRouter.get("/", asyncHandler(async (req: Request, res: Response) => {
  const page   = parseInt((req.query.page   as string) ?? "1",  10);
  const limit  = parseInt((req.query.limit  as string) ?? "25", 10);
  const search = req.query.search as string | undefined;
  const status = req.query.status as string | undefined;

  const where = {
    role: "PLAYER" as const,
    ...(status ? { status: status as any } : {}),
    ...(search ? {
      OR: [
        { email:     { contains: search, mode: "insensitive" as const } },
        { phone:     { contains: search } },
        { firstName: { contains: search, mode: "insensitive" as const } },
        { lastName:  { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true, email: true, phone: true, firstName: true, lastName: true,
        status: true, kycStatus: true, createdAt: true,
        wallet: { select: { balance: true } },
        _count:  { select: { bets: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.json({ success: true, data: { users, total, page, limit, totalPages: Math.ceil(total / limit) } });
}));

adminUsersRouter.get("/:id", asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: {
      wallet: { include: { transactions: { orderBy: { createdAt: "desc" }, take: 10 } } },
      kyc: true,
      _count: { select: { bets: true } },
    },
  });
  if (!user) { res.status(404).json({ success: false, error: "Utilisateur introuvable" }); return; }
  const { password: _, ...safeUser } = user;
  res.json({ success: true, data: safeUser });
}));

adminUsersRouter.patch("/:id/status", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body;
    if (!["ACTIVE", "SUSPENDED", "CLOSED"].includes(status)) {
      res.status(400).json({ success: false, error: "Statut invalide" }); return;
    }
    await prisma.user.update({ where: { id: req.params.id }, data: { status } });
    res.json({ success: true, message: `Statut mis à jour : ${status}` });
  }),
);

adminUsersRouter.patch("/:id/kyc", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, notes } = req.body;
    if (!["APPROVED", "REJECTED"].includes(status)) {
      res.status(400).json({ success: false, error: "Statut KYC invalide" }); return;
    }
    await prisma.kyc.update({
      where: { userId: req.params.id },
      data: { status, notes, reviewedAt: new Date() },
    });
    await prisma.user.update({ where: { id: req.params.id }, data: { kycStatus: status } });
    res.json({ success: true, message: `KYC ${status}` });
  }),
);
