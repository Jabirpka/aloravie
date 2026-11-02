import { createHash, randomInt } from "node:crypto";
import type { Customer } from "@prisma/client";
import { prisma } from "../../prisma.js";
import { env } from "../../env.js";
import {
  hashPassword,
  verifyPassword,
  signCustomerAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
  passwordResetExpiry,
  generateTempPassword,
} from "../../lib/auth.js";
import { badRequest, conflict, unauthorized, notFound } from "../../lib/http.js";
import { notifyPasswordReset } from "../notifications/notifications.service.js";
import { sendOtpSms } from "../../lib/sms-otp.js";

export interface PublicCustomer {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  phoneVerified: boolean;
  mustChangePassword: boolean;
}

export interface CustomerAuthResult {
  customer: PublicCustomer;
  accessToken: string;
  refreshToken: string;
}

function toPublic(c: Customer): PublicCustomer {
  return {
    id: c.id,
    email: c.email,
    name: c.name,
    phone: c.phone,
    phoneVerified: c.phoneVerified,
    mustChangePassword: c.mustChangePassword,
  };
}

async function issueTokens(customer: Customer): Promise<CustomerAuthResult> {
  const accessToken = signCustomerAccessToken({
    sub: customer.id,
    ...(customer.email ? { email: customer.email } : {}),
  });
  const refreshToken = generateRefreshToken();
  await prisma.customerRefreshToken.create({
    data: {
      customerId: customer.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshTokenExpiry(),
    },
  });
  return { customer: toPublic(customer), accessToken, refreshToken };
}

export async function register(input: {
  email: string;
  password: string;
  name: string;
  phone?: string;
}): Promise<CustomerAuthResult> {
  const existing = await prisma.customer.findUnique({ where: { email: input.email } });
  if (existing) throw conflict("An account with this email already exists");
  const customer = await prisma.customer.create({
    data: {
      email: input.email,
      name: input.name,
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
    },
  });
  return issueTokens(customer);
}

export async function login(input: { email: string; password: string }): Promise<CustomerAuthResult> {
  const customer = await prisma.customer.findUnique({ where: { email: input.email } });
  if (!customer || !customer.passwordHash) throw unauthorized("Invalid credentials");
  const ok = await verifyPassword(input.password, customer.passwordHash);
  if (!ok) throw unauthorized("Invalid credentials");
  return issueTokens(customer);
}

export async function refresh(rawToken: string): Promise<CustomerAuthResult> {
  const tokenHash = hashRefreshToken(rawToken);
  const stored = await prisma.customerRefreshToken.findUnique({
    where: { tokenHash },
    include: { customer: true },
  });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw unauthorized("Invalid or expired refresh token");
  }
  await prisma.customerRefreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  return issueTokens(stored.customer);
}

export async function logout(rawToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(rawToken);
  await prisma.customerRefreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getCustomerById(id: string): Promise<PublicCustomer | null> {
  const c = await prisma.customer.findUnique({ where: { id } });
  return c ? toPublic(c) : null;
}

// --- Addresses ---

export interface AddressInput {
  type?: "SHIPPING" | "BILLING";
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  isDefault?: boolean;
}

export function listAddresses(customerId: string) {
  return prisma.address.findMany({
    where: { customerId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}

export async function createAddress(customerId: string, input: AddressInput) {
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.address.updateMany({ where: { customerId }, data: { isDefault: false } });
    }
    return tx.address.create({
      data: {
        customerId,
        type: input.type ?? "SHIPPING",
        name: input.name,
        phone: input.phone,
        line1: input.line1,
        line2: input.line2,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        country: input.country ?? "IN",
        isDefault: input.isDefault ?? false,
      },
    });
  });
}

export async function updateAddress(customerId: string, id: string, input: Partial<AddressInput>) {
  const existing = await prisma.address.findFirst({ where: { id, customerId } });
  if (!existing) throw notFound("Address not found");
  return prisma.$transaction(async (tx) => {
    // Promoting this address to default clears the flag on the others first.
    if (input.isDefault) {
      await tx.address.updateMany({ where: { customerId }, data: { isDefault: false } });
    }
    return tx.address.update({
      where: { id },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.line1 !== undefined ? { line1: input.line1 } : {}),
        ...(input.line2 !== undefined ? { line2: input.line2 } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.state !== undefined ? { state: input.state } : {}),
        ...(input.pincode !== undefined ? { pincode: input.pincode } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      },
    });
  });
}

export async function deleteAddress(customerId: string, id: string) {
  const existing = await prisma.address.findFirst({ where: { id, customerId } });
  if (!existing) throw notFound("Address not found");
  await prisma.address.delete({ where: { id } });
}

// --- Passwords ---

function revokeAllSessions(customerId: string) {
  return prisma.customerRefreshToken.updateMany({
    where: { customerId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Signed-in customer changes their own password (must know the current one). */
export async function changePassword(customerId: string, currentPassword: string, newPassword: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw notFound("Account not found");
  if (!customer.passwordHash) throw badRequest("This account has no password set");
  const ok = await verifyPassword(currentPassword, customer.passwordHash);
  if (!ok) throw badRequest("Your current password is incorrect");
  await prisma.customer.update({
    where: { id: customerId },
    data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
  });
}

/**
 * Start the "forgot password" flow. Creates a single-use token and emails the
 * link. Resolves the same way whether or not the email exists, so the endpoint
 * never reveals which emails are registered.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const customer = await prisma.customer.findUnique({ where: { email } });
  if (!customer || !customer.email || !customer.passwordHash) return;

  const rawToken = generateRefreshToken();
  await prisma.passwordResetToken.create({
    data: { customerId: customer.id, tokenHash: hashRefreshToken(rawToken), expiresAt: passwordResetExpiry() },
  });

  const link = `${env.storefrontUrl}/reset-password?token=${rawToken}`;
  await notifyPasswordReset({ name: customer.name, email: customer.email }, link);
}

/** Complete a reset using the emailed token. Single-use; also ends other sessions. */
export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const token = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashRefreshToken(rawToken) } });
  if (!token || token.usedAt || token.expiresAt < new Date()) {
    throw badRequest("This reset link is invalid or has expired. Please request a new one.");
  }
  await prisma.$transaction([
    prisma.customer.update({
      where: { id: token.customerId },
      data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
    }),
    prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
    prisma.customerRefreshToken.updateMany({
      where: { customerId: token.customerId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

/**
 * Staff-assisted reset (customer care). Sets a temporary password, flags the
 * account so the storefront nudges a change, ends existing sessions, and returns
 * the temp password once for the agent to pass to the customer.
 */
export async function adminResetCustomerPassword(customerId: string): Promise<{ tempPassword: string; email: string | null }> {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw notFound("Customer not found");
  const tempPassword = generateTempPassword();
  await prisma.customer.update({
    where: { id: customerId },
    data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true },
  });
  await revokeAllSessions(customerId);
  return { tempPassword, email: customer.email };
}

// --- Google sign-in ---

interface GoogleIdentity {
  sub: string;
  email: string | null;
  name: string | null;
}

/**
 * Verify a Google ID token (the "credential" from Sign in with Google) using
 * Google's tokeninfo endpoint, and check it was issued for our client ID.
 */
async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  if (!env.GOOGLE_CLIENT_ID) throw badRequest("Google sign-in is not configured yet");
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) throw unauthorized("Could not verify your Google sign-in. Please try again.");
  const data = (await res.json()) as {
    aud?: string;
    sub?: string;
    email?: string;
    email_verified?: string;
    name?: string;
  };
  if (data.aud !== env.GOOGLE_CLIENT_ID) throw unauthorized("This Google sign-in was not issued for Aloravie");
  if (!data.sub) throw unauthorized("Google sign-in did not return an account id");
  if (data.email && data.email_verified !== "true") throw unauthorized("Your Google email is not verified");
  return { sub: data.sub, email: data.email ?? null, name: data.name ?? null };
}

/** Sign in (or create an account) with a Google ID token. Links by Google id, then email. */
export async function loginWithGoogle(idToken: string): Promise<CustomerAuthResult> {
  const g = await verifyGoogleIdToken(idToken);

  let customer = await prisma.customer.findUnique({ where: { googleSub: g.sub } });
  if (!customer && g.email) {
    const byEmail = await prisma.customer.findUnique({ where: { email: g.email } });
    if (byEmail) {
      customer = await prisma.customer.update({
        where: { id: byEmail.id },
        data: { googleSub: g.sub, ...(byEmail.name ? {} : { name: g.name ?? undefined }) },
      });
    }
  }
  if (!customer) {
    customer = await prisma.customer.create({ data: { googleSub: g.sub, email: g.email, name: g.name } });
  }
  return issueTokens(customer);
}

// --- Phone verification (OTP) ---

const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_PER_WINDOW = 5; // codes per 10 minutes per customer

function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export interface OtpRequestResult {
  ok: true;
  /** Present only in test mode (OTP_MODE=test): the code, so the flow can be completed without SMS. */
  devCode?: string;
}

/** Issue a one-time code for the customer to verify a phone number. */
export async function requestPhoneOtp(customerId: string, phoneRaw: string): Promise<OtpRequestResult> {
  const phone = phoneRaw.trim();
  if (!/^\+?[0-9]{7,15}$/.test(phone)) throw badRequest("Enter a valid phone number (with country code).");

  const recent = await prisma.phoneOtp.count({
    where: { customerId, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } },
  });
  if (recent >= OTP_MAX_PER_WINDOW) {
    throw badRequest("Too many code requests. Please wait a few minutes and try again.");
  }

  const code = generateOtpCode();
  await prisma.phoneOtp.create({
    data: {
      customerId,
      phone,
      codeHash: hashOtp(code),
      expiresAt: new Date(Date.now() + env.OTP_TTL_MINUTES * 60_000),
    },
  });

  if (env.OTP_MODE === "live") {
    const sent = await sendOtpSms(phone, code);
    if (!sent) throw badRequest("We couldn't send the code right now. Please try again in a moment.");
    return { ok: true };
  }
  // Test mode: return the code so it can be entered without a real SMS.
  console.info(`[otp] test-mode code for ${phone} (customer ${customerId}): ${code}`);
  return { ok: true, devCode: code };
}

/** Verify a code and mark the customer's phone as verified. */
export async function verifyPhoneOtp(customerId: string, phoneRaw: string, codeRaw: string): Promise<PublicCustomer> {
  const phone = phoneRaw.trim();
  const code = codeRaw.trim();

  const otp = await prisma.phoneOtp.findFirst({
    where: { customerId, phone, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) throw badRequest("Please request a new verification code.");
  if (otp.expiresAt < new Date()) throw badRequest("That code has expired. Please request a new one.");
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw badRequest("Too many wrong attempts. Please request a new code.");

  if (hashOtp(code) !== otp.codeHash) {
    await prisma.phoneOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw badRequest("That code is incorrect.");
  }

  // Phone numbers are unique across customers.
  const clash = await prisma.customer.findFirst({ where: { phone, NOT: { id: customerId } } });
  if (clash) throw conflict("This phone number is already linked to another account.");

  const results = await prisma.$transaction([
    prisma.phoneOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } }),
    prisma.customer.update({
      where: { id: customerId },
      data: { phone, phoneVerified: true, phoneVerifiedAt: new Date() },
    }),
  ]);
  return toPublic(results[1]);
}
