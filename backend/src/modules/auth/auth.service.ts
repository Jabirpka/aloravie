import type { User } from "@prisma/client";
import { prisma } from "../../prisma.js";
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
} from "../../lib/auth.js";
import { conflict, unauthorized } from "../../lib/http.js";

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: User["role"];
}

function toPublic(user: User): PublicUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

async function issueTokens(user: User): Promise<AuthResult> {
  const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });
  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshTokenExpiry(),
    },
  });
  return { user: toPublic(user), accessToken, refreshToken };
}

export async function register(input: {
  email: string;
  password: string;
  name: string;
}): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict("An account with this email already exists");

  // First ever user becomes the OWNER; everyone after is STAFF until promoted.
  const userCount = await prisma.user.count();
  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      role: userCount === 0 ? "OWNER" : "STAFF",
    },
  });
  return issueTokens(user);
}

export async function login(input: { email: string; password: string }): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.isActive) throw unauthorized("Invalid credentials");
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw unauthorized("Invalid credentials");
  return issueTokens(user);
}

export async function refresh(rawToken: string): Promise<AuthResult> {
  const tokenHash = hashRefreshToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw unauthorized("Invalid or expired refresh token");
  }
  // Rotate: revoke the used token, then issue a fresh pair.
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });
  return issueTokens(stored.user);
}

export async function logout(rawToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toPublic(user) : null;
}
