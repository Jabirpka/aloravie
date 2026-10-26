import type { Customer } from "@prisma/client";
import { prisma } from "../../prisma.js";
import {
  hashPassword,
  verifyPassword,
  signCustomerAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
} from "../../lib/auth.js";
import { conflict, unauthorized, notFound } from "../../lib/http.js";

export interface PublicCustomer {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
}

export interface CustomerAuthResult {
  customer: PublicCustomer;
  accessToken: string;
  refreshToken: string;
}

function toPublic(c: Customer): PublicCustomer {
  return { id: c.id, email: c.email, name: c.name, phone: c.phone };
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

export async function deleteAddress(customerId: string, id: string) {
  const existing = await prisma.address.findFirst({ where: { id, customerId } });
  if (!existing) throw notFound("Address not found");
  await prisma.address.delete({ where: { id } });
}
