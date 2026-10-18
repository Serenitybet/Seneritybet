import { Router, Request, Response } from "express";
import { z } from "zod";
import axios from "axios";
import bcrypt from "bcryptjs";
import * as authService from "../services/auth.service";
import { authenticate, AuthRequest } from "../middleware/auth.middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { AppError } from "../middleware/error.middleware";
import { prisma } from "../lib/prisma";

// ─── Vérification hCaptcha ───────────────────────────────────────────────────
async function verifyCaptcha(token: string): Promise<boolean> {
  const secret = process.env.HCAPTCHA_SECRET;
  if (!secret) return true; // Dev : pas de clé secrète → on passe
  try {
    const params = new URLSearchParams({ secret, response: token });
    const { data } = await axios.post<{ success: boolean }>(
      "https://hcaptcha.com/siteverify",
      params.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    return data.success === true;
  } catch {
    return false;
  }
}

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email("Email invalide"),
  phone: z.string().min(8, "Numéro invalide"),
  password: z.string().min(8, "Mot de passe trop court (8 caractères min)"),
  firstName: z.string().min(2, "Prénom trop court"),
  lastName: z.string().min(2, "Nom trop court"),
  dateOfBirth: z.string().refine((d) => {
    const age = (Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return age >= 18;
  }, "Vous devez avoir au moins 18 ans"),
});

authRouter.post("/register", asyncHandler(async (req: Request, res: Response) => {
  // ── Vérification CAPTCHA ────────────────────────────────────────────────────
  const captchaToken = req.body.captchaToken as string | undefined;
  if (process.env.HCAPTCHA_SECRET) {
    if (!captchaToken) {
      res.status(400).json({ success: false, error: "Vérification CAPTCHA manquante" });
      return;
    }
    const captchaOk = await verifyCaptcha(captchaToken);
    if (!captchaOk) {
      res.status(400).json({ success: false, error: "Vérification CAPTCHA échouée. Réessayez." });
      return;
    }
  }

  // ── Validation données ───────────────────────────────────────────────────────
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }
  const result = await authService.register(parsed.data);
  res.status(201).json({ success: true, data: result });
}));

authRouter.post("/login", asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ success: false, error: "Identifiant et mot de passe requis" });
    return;
  }
  // Accepte : ID numérique (playerNumber), téléphone ou email
  const result = await authService.login({ email, password });
  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ success: true, data: { user: result.user, accessToken: result.accessToken } });
}));

authRouter.post("/refresh", asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    res.status(401).json({ success: false, error: "Refresh token manquant" });
    return;
  }
  const tokens = await authService.refreshTokens(refreshToken);
  res.cookie("refreshToken", tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ success: true, data: { accessToken: tokens.accessToken } });
}));

authRouter.post("/logout", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  if (refreshToken) await authService.logout(refreshToken);
  res.clearCookie("refreshToken");
  res.json({ success: true, message: "Déconnecté avec succès" });
}));

authRouter.get("/me", authenticate, (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: req.user });
});

// PATCH /api/auth/me — modifier ses propres identifiants (email / mot de passe)
const updateMeSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  email: z.string().email("Email invalide").optional(),
  newPassword: z.string().min(8, "Nouveau mot de passe trop court (8 caractères min)").optional(),
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
});

authRouter.patch("/me", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, parsed.error.errors[0].message);
  const { currentPassword, email, newPassword, firstName, lastName } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) throw new AppError(404, "Utilisateur introuvable");

  const validPassword = await bcrypt.compare(currentPassword, user.password);
  if (!validPassword) throw new AppError(401, "Mot de passe actuel incorrect");

  if (email && email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError(400, "Cet email est déjà utilisé");
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(email ? { email } : {}),
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
      ...(newPassword ? { password: await bcrypt.hash(newPassword, 12) } : {}),
    },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });

  res.json({ success: true, data: updated, message: "Identifiants mis à jour ✓" });
}));
