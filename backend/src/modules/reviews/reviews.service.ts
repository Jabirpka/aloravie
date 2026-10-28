import type { ReviewStatus } from "@prisma/client";
import { prisma } from "../../prisma.js";
import { badRequest, conflict, notFound } from "../../lib/http.js";

const PURCHASED_STATUSES = ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "RETURNED"] as const;

// Public: published reviews + aggregate for a product.
export async function listPublished(slug: string) {
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product) throw notFound("Product not found");
  const reviews = await prisma.review.findMany({
    where: { productId: product.id, status: "PUBLISHED" },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const count = reviews.length;
  const average = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
  return {
    average: Math.round(average * 10) / 10,
    count,
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      verifiedPurchase: r.verifiedPurchase,
      authorName: r.customer.name ?? "Aloravie customer",
      createdAt: r.createdAt,
    })),
  };
}

export async function createReview(
  customerId: string,
  slug: string,
  input: { rating: number; title?: string; body?: string },
) {
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product) throw notFound("Product not found");
  if (input.rating < 1 || input.rating > 5) throw badRequest("Rating must be between 1 and 5");

  const existing = await prisma.review.findUnique({
    where: { productId_customerId: { productId: product.id, customerId } },
  });
  if (existing) throw conflict("You've already reviewed this product");

  // Verified purchase = a non-cancelled order by this customer containing the product.
  const purchased = await prisma.order.findFirst({
    where: {
      customerId,
      status: { in: [...PURCHASED_STATUSES] },
      items: { some: { variant: { productId: product.id } } },
    },
  });

  return prisma.review.create({
    data: {
      productId: product.id,
      customerId,
      rating: input.rating,
      title: input.title,
      body: input.body,
      verifiedPurchase: Boolean(purchased),
    },
  });
}

// --- Admin moderation ---

const adminInclude = {
  product: { select: { title: true, slug: true } },
  customer: { select: { name: true, email: true } },
} as const;

export function adminList(status?: ReviewStatus) {
  return prisma.review.findMany({
    where: status ? { status } : {},
    include: adminInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function setStatus(id: string, status: ReviewStatus) {
  const existing = await prisma.review.findUnique({ where: { id } });
  if (!existing) throw notFound("Review not found");
  return prisma.review.update({ where: { id }, data: { status }, include: adminInclude });
}
