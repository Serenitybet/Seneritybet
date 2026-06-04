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
import seedRouter from "./routes/seed.routes";
import { withdrawalRequestRouter } from "./routes/withdrawal-request.routes";
import { cashierWalletRouter } from "./routes/cashier-wallet.routes";
import { errorHandler } from "./middleware/error.middleware";

export const app = express();

app.use(helmet());
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
    ];

app.use(cors({
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origin (Postman, curl, mobile)
    if (!origin) return callback(null, true);
    // Autoriser les sous-domaines *.vercel.app en production
    if (
      ALLOWED_ORIGINS.includes(origin) ||
      /^https:\/\/[\w-]+(\.vercel\.app)$/.test(origin) ||
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

// Webhooks Mobile Money avant le parsing JSON (raw body requis)
app.use("/api/webhooks", webhookRouter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Élargi de 10 à 20 pour le développement
  message: { success: false, error: "Trop de tentatives, réessayez dans 15 minutes." },
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "serenitybet-api", timestamp: new Date().toISOString() });
});

// ─── Routes publiques ─────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/sports", sportsRouter);

// ─── Routes authentifiées ────────────────────────────────────────────────────
app.use("/api/bets", bettingRouter);
app.use("/api/wallet", walletRouter);

// ─── Routes admin ────────────────────────────────────────────────────────────
app.use("/api/admin", adminRouter);

// ─── Routes caisse (POS) ─────────────────────────────────────────────────────
app.use("/api/cashier", cashierRouter);

// ─── Demandes de retrait espèces ─────────────────────────────────────────────
app.use("/api/withdrawals", withdrawalRequestRouter);

// ─── Portefeuille caissier ───────────────────────────────────────────────────
app.use("/api/cashier-wallet", cashierWalletRouter);

// ─── Route seed temporaire (init admin) ──────────────────────────────────────
app.use("/api/seed", seedRouter);

// ─── Gestion des erreurs (doit être en dernier) ───────────────────────────────
app.use(errorHandler);
