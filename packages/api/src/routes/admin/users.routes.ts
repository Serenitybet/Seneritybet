import { Router, Request, Response } from "express";
import { requireRole, AuthRequest } from "../../middleware/auth.middleware";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import bcrypt from "bcryptjs";

export const adminUsersRouter = Router();

// Hiérarchie de pouvoir du personnel — un rôle ne peut agir (suspendre,
// réinitialiser le mot de passe, changer le rôle) que sur un compte de rang
// strictement inférieur au sien, sauf SUPER_ADMIN qui peut agir sur
// n'importe qui. Empêche un ADMIN banal de suspendre/modifier un autre
// ADMIN ou un SUPER_ADMIN (faille de sécurité corrigée).
const ROLE_RANK: Record<string, number> = {
  CASHIER: 1,
  TRADER: 2,
  FINANCE: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};
function canManage(actorRole: string, targetRole: string): boolean {
  if (actorRole === "SUPER_ADMIN") return true;
  return (ROLE_RANK[actorRole] ?? 0) > (ROLE_RANK[targetRole] ?? 0);
}

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
    // shopId optionnel — peut être assigné plus tard depuis le backoffice
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
        // Créer automatiquement un portefeuille vide pour les caissiers
        ...(role === "CASHIER" ? { cashierWallet: { create: { balance: BigInt(0) } } } : {}),
      },
    });
    res.status(201).json({ success: true, data: { id: user.id, email: user.email, role: user.role } });
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
        id: true, playerNumber: true, email: true, phone: true, firstName: true, lastName: true,
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

// PATCH /api/admin/users/:id/role — changer le rôle (pouvoirs) d'un membre du personnel
adminUsersRouter.patch("/:id/role", requireRole("SUPER_ADMIN"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { role } = req.body;
    const allowedRoles = ["CASHIER", "TRADER", "FINANCE", "ADMIN", "SUPER_ADMIN"];
    if (!allowedRoles.includes(role)) {
      res.status(400).json({ success: false, error: "Rôle non autorisé" }); return;
    }
    if (req.params.id === req.user!.id) {
      res.status(400).json({ success: false, error: "Impossible de modifier votre propre rôle" }); return;
    }
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) { res.status(404).json({ success: false, error: "Utilisateur introuvable" }); return; }
    if (target.role === "PLAYER") {
      res.status(400).json({ success: false, error: "Impossible de modifier le rôle d'un joueur" }); return;
    }
    await prisma.user.update({ where: { id: req.params.id }, data: { role } });
    res.json({ success: true, message: `Rôle mis à jour : ${role}` });
  }),
);

adminUsersRouter.patch("/:id/status", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status } = req.body;
    if (!["ACTIVE", "SUSPENDED", "CLOSED"].includes(status)) {
      res.status(400).json({ success: false, error: "Statut invalide" }); return;
    }
    if (req.params.id === req.user!.id) {
      res.status(400).json({ success: false, error: "Impossible de modifier votre propre statut" }); return;
    }
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) { res.status(404).json({ success: false, error: "Utilisateur introuvable" }); return; }
    if (!canManage(req.user!.role, target.role)) {
      res.status(403).json({ success: false, error: "Vous n'avez pas l'autorité pour modifier ce compte" }); return;
    }
    await prisma.user.update({ where: { id: req.params.id }, data: { status } });
    res.json({ success: true, message: `Statut mis à jour : ${status}` });
  }),
);

// PATCH /api/admin/users/:id/recharge — recharger le portefeuille d'un caissier
adminUsersRouter.patch("/:id/recharge", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { amount } = req.body;
    if (!amount || Number(amount) <= 0) {
      res.status(400).json({ success: false, error: "Montant invalide" }); return;
    }
    const amountCentimes = BigInt(Math.round(Number(amount) * 100));

    const wallet = await prisma.cashierWallet.upsert({
      where: { userId: req.params.id },
      create: { userId: req.params.id, balance: amountCentimes },
      update: { balance: { increment: amountCentimes } },
    });

    res.json({
      success: true,
      message: `Portefeuille rechargé de ${Number(amount).toLocaleString("fr-FR")} XAF`,
      data: { newBalanceXAF: Number(wallet.balance) / 100 },
    });
  }),
);

adminUsersRouter.patch("/:id/password", requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ success: false, error: "Mot de passe trop court (6 caractères minimum)" }); return;
    }
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) { res.status(404).json({ success: false, error: "Utilisateur introuvable" }); return; }
    if (!canManage(req.user!.role, target.role)) {
      res.status(403).json({ success: false, error: "Vous n'avez pas l'autorité pour modifier ce compte" }); return;
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
