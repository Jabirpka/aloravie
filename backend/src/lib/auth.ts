import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes, createHash } from "node:crypto";
import { env } from "../env.js";
import type { Department, UserRole } from "@prisma/client";

export interface AccessTokenPayload {
  sub: string; // user id
  role: UserRole;
  email: string;
  departments: Department[];
}

const BCRYPT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Parse a short duration like "15m", "2h", "30d", "45s" into seconds. */
export function durationToSeconds(input: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(input.trim());
  if (!match) throw new Error(`Invalid duration: "${input}"`);
  const value = Number(match[1]);
  const unit = match[2];
  const factor = unit === "s" ? 1 : unit === "m" ? 60 : unit === "h" ? 3600 : 86400;
  return value * factor;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: durationToSeconds(env.ACCESS_TOKEN_TTL),
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof decoded === "string") throw new Error("Unexpected token form");
  const { sub, role, email, departments } = decoded as jwt.JwtPayload & Partial<AccessTokenPayload>;
  if (!sub || !role || !email) throw new Error("Malformed access token");
  return { sub, role, email, departments: departments ?? [] };
}

// --- Customer (storefront) access tokens ---

export interface CustomerTokenPayload {
  sub: string; // customer id
  typ: "customer";
  email?: string;
}

export function signCustomerAccessToken(payload: Omit<CustomerTokenPayload, "typ">): string {
  return jwt.sign({ ...payload, typ: "customer" }, env.JWT_ACCESS_SECRET, {
    expiresIn: durationToSeconds(env.ACCESS_TOKEN_TTL),
  });
}

export function verifyCustomerAccessToken(token: string): CustomerTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof decoded === "string") throw new Error("Unexpected token form");
  const payload = decoded as jwt.JwtPayload & Partial<CustomerTokenPayload>;
  if (!payload.sub || payload.typ !== "customer") throw new Error("Not a customer token");
  return { sub: payload.sub, typ: "customer", ...(payload.email ? { email: payload.email } : {}) };
}

// --- Refresh tokens: random opaque string; only its hash is stored. ---

export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400 * 1000);
}

// --- Password reset ---

/** Expiry for a password-reset link: short-lived (1 hour). */
export function passwordResetExpiry(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}

/**
 * A short, human-typeable temporary password that staff can read out to a
 * locked-out customer. Uses an unambiguous alphabet (no 0/O/1/l/I).
 */
export function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}
