import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { setSession, deleteSession } from "../lib/redis";
import { AppError } from "../middleware/error.middleware";
import type { RegisterPayload, LoginPayload } from "@serenitybet/shared";

export async function register(payload: RegisterPayload) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: payload.email }, { phone: payload.phone }] },
  });
  if (existing) {
    throw new AppError(409, "Email ou téléphone déjà utilisé");
  }

  const password = await bcrypt.hash(payload.password, 12);
  const user = await prisma.user.create({
    data: {
      email: payload.email,
      phone: payload.phone,
      password,
      firstName: payload.firstName,
      lastName: payload.lastName,
      dateOfBirth: new Date(payload.dateOfBirth),
      wallet: { create: { balance: BigInt(0) } },
    },
    select: { id: true, playerNumber: true, email: true, phone: true, firstName: true, lastName: true, role: true, kycStatus: true, createdAt: true },
  });

  const tokens = generateTokens(user.id, user.role, user.email);
  await setSession(tokens.refreshToken, user.id);

  return { user, ...tokens };
}

export async function login(payload: LoginPayload) {
  const identifier = payload.email.trim();

  // Recherche par playerNumber (6 chiffres), téléphone, code caissier (TPE,
  // voir cashierCode) ou email. Un email contient toujours "@" — jamais
  // confondu avec un code caissier, qui lui n'en contient jamais (défini par
  // l'admin à la création du caissier, voir admin/users.routes.ts).
  const isEmail = identifier.includes("@");
  const isPlayerNumber = !isEmail && /^\d{6}$/.test(identifier);
  const isPhone = !isEmail && !isPlayerNumber && /^\+?\d{8,15}$/.test(identifier);
  const isCashierCode = !isEmail && !isPlayerNumber && !isPhone;

  const user = await prisma.user.findFirst({
    where: isPlayerNumber
      ? { playerNumber: parseInt(identifier, 10) }
      : isPhone
      ? { phone: identifier }
      : isCashierCode
      ? { cashierCode: identifier.toUpperCase() }
      : { email: identifier },
  });

  if (!user) throw new AppError(401, "Identifiant ou mot de passe incorrect");
  if (user.status !== "ACTIVE") throw new AppError(403, "Compte suspendu ou fermé");

  const valid = await bcrypt.compare(payload.password, user.password);
  if (!valid) throw new AppError(401, "Email ou mot de passe incorrect");

  const tokens = generateTokens(user.id, user.role, user.email);
  await setSession(tokens.refreshToken, user.id);

  const { password: _, ...safeUser } = user;
  return { user: safeUser, ...tokens };
}

// userId vient de req.user (déjà authentifié sur la route logout) — stampe
// tokensRevokedAt pour que tout token (accès ou rafraîchissement) déjà émis
// cesse immédiatement d'être accepté par authenticate()/refreshTokens(),
// au lieu de rester valable jusqu'à son expiration naturelle.
export async function logout(userId: string, refreshToken: string) {
  await prisma.user.update({ where: { id: userId }, data: { tokensRevokedAt: new Date() } });
  await deleteSession(refreshToken);
}

export async function refreshTokens(refreshToken: string) {
  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as {
      sub: string;
      role: string;
      email: string;
      iat: number;
    };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, email: true, status: true, tokensRevokedAt: true },
    });
    if (!user || user.status !== "ACTIVE") throw new AppError(401, "Compte inactif");
    if (user.tokensRevokedAt && payload.iat * 1000 < user.tokensRevokedAt.getTime()) {
      throw new AppError(401, "Session expirée — reconnectez-vous");
    }

    await deleteSession(refreshToken);
    const tokens = generateTokens(user.id, user.role, user.email);
    await setSession(tokens.refreshToken, user.id);
    return tokens;
  } catch {
    throw new AppError(401, "Refresh token invalide");
  }
}

function generateTokens(userId: string, role: string, email: string) {
  // Joueurs : 8h (journée complète de paris sans déconnexion)
  // Caissiers/Admins/autres : configurable via JWT_EXPIRES_IN (défaut 24h) —
  // la vraie limite de session vient de la déconnexion automatique après
  // inactivité côté client (TPE, backoffice), pas de la durée du token lui-
  // même : un token trop court fait échouer silencieusement les appels API
  // en pleine utilisation active.
  const accessExpiry =
    role === "PLAYER" ? "8h" : (process.env.JWT_EXPIRES_IN ?? "24h");

  const accessToken = jwt.sign(
    { sub: userId, role, email },
    process.env.JWT_SECRET!,
    { expiresIn: accessExpiry },
  );

  const refreshToken = jwt.sign(
    { sub: userId, role, email },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d" },
  );

  return { accessToken, refreshToken };
}
