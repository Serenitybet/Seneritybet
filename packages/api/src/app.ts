import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import { authRouter } from "./routes/auth.routes";
import { sportsRouter } from "./routes/sports.routes";
import { bettingRouter } from "./routes/betting.routes";
import { walletRouter } from "./routes/wallet.routes";
import { webhookRouter } from "./routes/webhook.routes";
import { adminRouter } from "./routes/admin/index.routes";
import { cashierRouter } from "./routes/cashier.routes";
import { withdrawalRequestRouter } from "./routes/withdrawal-request.routes";
import { cashierWalletRouter } from "./routes/cashier-wallet.routes";
import { couponRouter } from "./routes/coupon.routes";
import { partnersRouter } from "./routes/partners.routes";
import { errorHandler } from "./middleware/error.middleware";

export const app = express();

// ─── Sécurité headers (helmet) ────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // géré par Next.js côté frontend
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003"];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      ALLOWED_ORIGINS.includes(origin) ||
      /^https:\/\/[\w-]+(\.vercel\.app)$/.test(origin) ||
      /^https:\/\/([\w-]+\.)?serenitybet\.africa$/.test(origin) ||
      /^https:\/\/[\w-]+\.serenitybet\.td$/.test(origin)
    ) {
      return callback(null, true);
    }
    callback(new Error(`CORS bloqué : ${origin}`));
  },
  credentials: true,
}));

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(cookieParser());

// Webhooks avant le parsing JSON
app.use("/api/webhooks", webhookRouter);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ─── Rate limiting ────────────────────────────────────────────────────────────

// Limite générale : 300 req / 15 min par IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Trop de requêtes. Réessayez dans 15 minutes." },
});

// Limite stricte auth : 10 tentatives / 15 min (anti brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Trop de tentatives de connexion. Réessayez dans 15 minutes." },
  skipSuccessfulRequests: true, // ne compte que les échecs
});

// Limite inscription : 5 comptes / heure par IP (anti-spam)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Trop de créations de compte. Réessayez dans 1 heure." },
});

app.use("/api/", generalLimiter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "serenitybet-api", timestamp: new Date().toISOString() });
});

// ─── Routes publiques ─────────────────────────────────────────────────────────
app.use("/api/auth/login",    authLimiter);
app.use("/api/auth/register", registerLimiter);
app.use("/api/auth",    authRouter);
app.use("/api/sports",  sportsRouter);

// ─── Routes authentifiées ────────────────────────────────────────────────────
app.use("/api/bets",     bettingRouter);
app.use("/api/wallet",   walletRouter);

// ─── Routes admin ────────────────────────────────────────────────────────────
app.use("/api/admin", adminRouter);

// ─── Routes caisse (POS) ─────────────────────────────────────────────────────
app.use("/api/cashier",        cashierRouter);
app.use("/api/withdrawals",    withdrawalRequestRouter);
app.use("/api/cashier-wallet", cashierWalletRouter);

// ─── Coupons / Tickets physiques ─────────────────────────────────────────────
app.use("/api/coupons", couponRouter);

// ─── Programme partenaires ───────────────────────────────────────────────────
app.use("/api/partners", partnersRouter);

// ─── Gestion des erreurs ─────────────────────────────────────────────────────
app.use(errorHandler);
