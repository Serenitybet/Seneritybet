import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { AppError } from "../middleware/error.middleware";

export const partnersRouter = Router();

function generateToken(partnerId: string) {
  return jwt.sign({ sub: partnerId, type: "partner" }, process.env.JWT_SECRET!, { expiresIn: "30d" });
}

async function authenticate(req: any, res: Response, next: any) {
  const token = req.headers.authorization?.slice(7);
  if (!token) { res.status(401).json({ success: false, error: "Token manquant" }); return; }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string; type: string };
    if (payload.type !== "partner") throw new Error();
    const partner = await prisma.partner.findUnique({ where: { id: payload.sub } });
    if (!partner || partner.status === "SUSPENDED") {
      res.status(401).json({ success: false, error: "Accès refusé" }); return;
    }
    req.partner = partner;
    next();
  } catch {
    res.status(401).json({ success: false, error: "Token invalide" });
  }
}

// POST /api/partners/register
partnersRouter.post("/register", asyncHandler(async (req: Request, res: Response) => {
  const { email, phone, firstName, lastName, password, bio, socialMedia, promoCode } = req.body;
  if (!email || !phone || !firstName || !lastName || !password) {
    throw new AppError(400, "Tous les champs obligatoires doivent être remplis");
  }

  const exists = await prisma.partner.findFirst({ where: { OR: [{ email }, { phone }] } });
  if (exists) throw new AppError(409, "Email ou téléphone déjà utilisé");

  // Générer ou valider le code promo
  let finalCode = promoCode
    ? `STAR-${promoCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)}`
    : `STAR-${firstName.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8)}`;

  // S'assurer que le code est unique
  let suffix = 0;
  while (await prisma.partner.findUnique({ where: { promoCode: finalCode } })) {
    suffix++;
    finalCode = promoCode
      ? `STAR-${promoCode.toUpperCase().slice(0, 8)}${suffix}`
      : `STAR-${firstName.toUpperCase().slice(0, 6)}${suffix}`;
  }

  const hash = await bcrypt.hash(password, 10);
  const partner = await prisma.partner.create({
    data: {
      email, phone, firstName, lastName,
      password: hash,
      promoCode: finalCode,
      bio: bio ?? null,
      socialMedia: socialMedia ?? null,
      status: "PENDING",
    },
  });

  res.status(201).json({
    success: true,
    message: "Demande reçue ! Votre compte sera activé sous 24h.",
    data: { promoCode: partner.promoCode },
  });
}));

// POST /api/partners/login
partnersRouter.post("/login", asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError(400, "Email et mot de passe requis");

  const partner = await prisma.partner.findUnique({ where: { email } });
  if (!partner) throw new AppError(401, "Identifiants incorrects");
  if (partner.status === "PENDING") throw new AppError(403, "Votre compte est en attente de validation");
  if (partner.status === "SUSPENDED") throw new AppError(403, "Compte suspendu");

  const valid = await bcrypt.compare(password, partner.password);
  if (!valid) throw new AppError(401, "Identifiants incorrects");

  const token = generateToken(partner.id);
  const { password: _, ...safePartner } = partner;

  res.json({ success: true, data: { token, partner: safePartner } });
}));

// GET /api/partners/me — dashboard data
partnersRouter.get("/me", authenticate, asyncHandler(async (req: any, res: Response) => {
  const partner = req.partner;

  const now     = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalReferrals, recentCommissions, thisMonthSum] = await Promise.all([
    prisma.partnerReferral.count({ where: { partnerId: partner.id } }),
    prisma.partnerCommission.findMany({
      where:   { partnerId: partner.id },
      orderBy: { createdAt: "desc" },
      take:    20,
    }),
    prisma.partnerCommission.aggregate({
      where: { partnerId: partner.id, createdAt: { gte: firstDay } },
      _sum:  { amount: true },
    }),
  ]);

  const { password: _, ...safePartner } = partner;

  res.json({
    success: true,
    data: {
      partner: safePartner,
      stats: {
        totalReferrals,
        totalEarned:  partner.totalEarned,
        balance:      partner.balance,
        thisMonth:    thisMonthSum._sum.amount ?? 0,
      },
      recentCommissions,
    },
  });
}));

// POST /api/partners/withdraw — demande de retrait
partnersRouter.post("/withdraw", authenticate, asyncHandler(async (req: any, res: Response) => {
  const { amount, method, account } = req.body;
  const partner = req.partner;

  if (!amount || amount < 1000) throw new AppError(400, "Montant minimum : 1 000 XAF");
  if (partner.balance < amount) throw new AppError(400, "Solde insuffisant");

  const withdrawal = await prisma.$transaction([
    prisma.partnerWithdrawal.create({
      data: { partnerId: partner.id, amount, method, account, status: "PENDING" },
    }),
    prisma.partner.update({
      where: { id: partner.id },
      data:  { balance: { decrement: amount } },
    }),
  ]);

  res.json({ success: true, data: { id: withdrawal[0].id, amount, method } });
}));

// GET /api/partners/promo/:code — vérifier un code (utilisé à l'inscription joueur)
partnersRouter.get("/promo/:code", asyncHandler(async (req: Request, res: Response) => {
  const partner = await prisma.partner.findUnique({
    where:  { promoCode: req.params.code.toUpperCase() },
    select: { id: true, firstName: true, lastName: true, promoCode: true, status: true },
  });
  if (!partner || partner.status !== "ACTIVE") {
    res.status(404).json({ success: false, error: "Code promo invalide" }); return;
  }
  res.json({ success: true, data: partner });
}));
