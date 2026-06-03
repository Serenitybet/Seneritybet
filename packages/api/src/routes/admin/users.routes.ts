import { Router, Request, Response } from "express";
import { requireRole } from "../../middleware/auth.middleware";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import bcrypt from "bcryptjs";

export const adminUsersRouter = Router();

// POST /api/admin/users — créer un caissier ou admin
adminUsersRouter.post("/", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, phone, firstName, lastName, password, role, dateOfBirth, shopId } = req.body;

    if (!email || !phone || !firstName || !lastName || !password || !role) {
      res.status(400).json({ success: false, error: "Tous les champs sont requis" }); return;
    }
    const allowedRoles = ["CASHIER", "TRADER", "FINANCE", "ADMIN"];
    if (!allowedRoles.includes(role)) {
      res.status(400).json({ success: false, error: "Rôle non autorisé" }); return;
    }
    if (role === "CASHIER" && !shopId) {
      res.status(400).json({ success: false, error: "Un caissier doit être assigné à une boutique" }); return;
    }
    const exists = await prisma.user.findFirst({ where: { OR: [{ email }, { phone }] } });
    if (exists) {
      res.status(409).json({ success: false, error: "Email ou téléphone déjà utilisé" }); return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email, phone, firstName, lastName, password: passwordHash, role,
        status: "ACTIVE",
        kycStatus: "APPROVED",
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : new Date("1990-01-01"),
        ...(shopId ? { shopId } : {}),
      },
      include: { shop: { select: { name: true, city: true } } },
    });
    res.status(201).json({ success: true, data: { id: user.id, email: user.email, role: user.role, shop: (user as any).shop } });
  }),
);

// GET /api/admin/users/staff — liste du personnel (non-PLAYER)
adminUsersRouter.get("/staff", asyncHandler(async (req: Request, res: Response) => {
  const search = req.query.search as string | undefined;
  const playerNumSearch = search && /^\d+$/.test(search.trim()) ? parseInt(search.trim(), 10) : null;

  const staff = await prisma.user.findMany({
    where: {
      role: { not: "PLAYER" },
      ...(search ? {
        OR: [
          { email:     { contains: search, mode: "insensitive" as const } },
          { phone:     { contains: search } },
          { firstName: { contains: search, mode: "insensitive" as const } },
          { lastName:  { contains: search, mode: "insensitive" as const } },
          ...(playerNumSearch ? [{ playerNumber: playerNumSearch }] : []),
        ],
      } : {}),
    },
    select: {
      id: true, playerNumber: true, email: true, phone: true, firstName: true, lastName: true,
      role: true, status: true, kycStatus: true, createdAt: true,
      shop: { select: { id: true, name: true, city: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ success: true, data: { users: staff, total: staff.length } });
}));

adminUsersRouter.get("/", asyncHandler(async (req: Request, res: Response) => {
  const page   = parseInt((req.query.page   as string) ?? "1",  10);
  const limit  = parseInt((req.query.limit  as string) ?? "25", 10);
  const search = req.query.search as string | undefined;
  const status = req.query.status as string | undefined;

  const playerNumSearch = search && /^\d+$/.test(search.trim()) ? parseInt(search.trim(), 10) : null;

  const where = {
    role: "PLAYER" as const,
    ...(status ? { status: status as any } : {}),
    ...(search ? {
      OR: [
        { email:        { contains: search, mode: "insensitive" as const } },
        { phone:        { contains: search } },
        { firstName:    { contains: search, mode: "insensitive" as const } },
        { lastName:     { contains: search, mode: "insensitive" as const } },
        ...(playerNumSearch ? [{ playerNumber: playerNumSearch }] : []),
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

adminUsersRouter.patch("/:id/password", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ success: false, error: "Mot de passe trop court (6 caractères minimum)" }); return;
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.params.id }, data: { password: hash } });
    res.json({ success: true, message: "Mot de passe réinitialisé avec succès" });
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
