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
    select: { id: true, email: true, phone: true, firstName: true, lastName: true, role: true, kycStatus: true, createdAt: true },
  });

  const tokens = generateTokens(user.id, user.role, user.email);
  await setSession(tokens.refreshToken, user.id);

  return { user, ...tokens };
}

export async function login(payload: LoginPayload) {
  const user = await prisma.user.findUnique({ where: { email: payload.email } });
  if (!user) throw new AppError(401, "Email ou mot de passe incorrect");
  if (user.status !== "ACTIVE") throw new AppError(403, "Compte suspendu ou fermé");

  const valid = await bcrypt.compare(payload.password, user.password);
  if (!valid) throw new AppError(401, "Email ou mot de passe incorrect");

  const tokens = generateTokens(user.id, user.role, user.email);
  await setSession(tokens.refreshToken, user.id);

  const { password: _, ...safeUser } = user;
  return { user: safeUser, ...tokens };
}

export async function logout(refreshToken: string) {
  await deleteSession(refreshToken);
}

export async function refreshTokens(refreshToken: string) {
  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as {
      sub: string;
      role: string;
      email: string;
    };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, email: true, status: true },
    });
    if (!user || user.status !== "ACTIVE") throw new AppError(401, "Compte inactif");

    await deleteSession(refreshToken);
    const tokens = generateTokens(user.id, user.role, user.email);
    await setSession(tokens.refreshToken, user.id);
    return tokens;
  } catch {
    throw new AppError(401, "Refresh token invalide");
  }
}

function generateTokens(userId: string, role: string, email: string) {
  const accessToken = jwt.sign(
    { sub: userId, role, email },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? "15m" },
  );

  const refreshToken = jwt.sign(
    { sub: userId, role, email },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d" },
  );

  return { accessToken, refreshToken };
}
