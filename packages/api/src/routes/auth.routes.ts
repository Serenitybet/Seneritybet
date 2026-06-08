import { Router, Request, Response } from "express";
import { z } from "zod";
import axios from "axios";
import * as authService from "../services/auth.service";
import { authenticate, AuthRequest } from "../middleware/auth.middleware";
import { asyncHandler } from "../lib/asyncHandler";

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
