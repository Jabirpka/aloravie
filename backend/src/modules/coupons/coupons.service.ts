import type { DiscountType } from "@prisma/client";
import { prisma } from "../../prisma.js";
import { badRequest, conflict, notFound } from "../../lib/http.js";
import { formatMoney } from "../../lib/money.js";

export interface CouponPreview {
  code: string;
  description: string | null;
  discountMinor: number;
}

// Validate a code against a cart subtotal and return the discount. Throws a
// human-readable reason when it can't be applied. Used by the preview endpoint
// and by checkout (which is authoritative).
export async function validateCoupon(code: string, subtotalMinor: number) {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!coupon || !coupon.active) throw badRequest("This code isn't valid");
  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) throw badRequest("This offer hasn't started yet");
  if (coupon.endsAt && now > coupon.endsAt) throw badRequest("This offer has expired");
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    throw badRequest("This offer has been fully redeemed");
  }
  if (subtotalMinor < coupon.minSpendMinor) {
    throw badRequest(`Spend at least ${formatMoney(coupon.minSpendMinor, coupon.currency)} to use this code`);
  }

  let discountMinor = coupon.type === "PERCENT" ? Math.round((subtotalMinor * coupon.value) / 100) : coupon.value;
  if (coupon.type === "PERCENT" && coupon.maxDiscountMinor != null) {
    discountMinor = Math.min(discountMinor, coupon.maxDiscountMinor);
  }
  discountMinor = Math.min(discountMinor, subtotalMinor);
  return { coupon, discountMinor };
}

export async function previewCoupon(code: string, subtotalMinor: number): Promise<CouponPreview> {
  const { coupon, discountMinor } = await validateCoupon(code, subtotalMinor);
  return { code: coupon.code, description: coupon.description, discountMinor };
}

// --- Admin (OFFERS department) ---

export function listCoupons() {
  return prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
}

export interface CouponInput {
  code: string;
  description?: string;
  type: DiscountType;
  value: number;
  minSpendMinor?: number;
  maxDiscountMinor?: number | null;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimit?: number | null;
}

export async function createCoupon(input: CouponInput) {
  const code = input.code.trim().toUpperCase();
  if (!code) throw badRequest("A code is required");
  const existing = await prisma.coupon.findUnique({ where: { code } });
  if (existing) throw conflict("A coupon with this code already exists");
  return prisma.coupon.create({
    data: {
      code,
      description: input.description,
      type: input.type,
      value: input.value,
      minSpendMinor: input.minSpendMinor ?? 0,
      maxDiscountMinor: input.maxDiscountMinor ?? null,
      active: input.active ?? true,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      usageLimit: input.usageLimit ?? null,
    },
  });
}

export async function updateCoupon(id: string, input: Partial<CouponInput>) {
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) throw notFound("Coupon not found");
  return prisma.coupon.update({
    where: { id },
    data: {
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.value !== undefined ? { value: input.value } : {}),
      ...(input.minSpendMinor !== undefined ? { minSpendMinor: input.minSpendMinor } : {}),
      ...(input.maxDiscountMinor !== undefined ? { maxDiscountMinor: input.maxDiscountMinor } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.usageLimit !== undefined ? { usageLimit: input.usageLimit } : {}),
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt ? new Date(input.startsAt) : null } : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt ? new Date(input.endsAt) : null } : {}),
    },
  });
}
