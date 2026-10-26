import type { ProductStatus } from "@prisma/client";
import { prisma } from "../../prisma.js";
import { conflict, notFound } from "../../lib/http.js";

const productInclude = {
  category: true,
  images: { orderBy: { position: "asc" } },
  variants: { orderBy: { createdAt: "asc" } },
} as const;

export async function listProducts(opts: { status?: ProductStatus } = {}) {
  return prisma.product.findMany({
    where: opts.status ? { status: opts.status } : {},
    include: productInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function getProductBySlug(slug: string) {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: productInclude,
  });
  if (!product) throw notFound(`Product "${slug}" not found`);
  return product;
}

export interface CreateProductInput {
  title: string;
  slug: string;
  description?: string;
  status?: ProductStatus;
  categoryId?: string;
  images?: { url: string; alt?: string; position?: number }[];
  variants: { sku: string; name: string; priceMinor: number; currency?: string; barcode?: string }[];
}

export async function createProduct(input: CreateProductInput) {
  const existing = await prisma.product.findUnique({ where: { slug: input.slug } });
  if (existing) throw conflict(`A product with slug "${input.slug}" already exists`);

  return prisma.product.create({
    data: {
      title: input.title,
      slug: input.slug,
      description: input.description,
      status: input.status ?? "DRAFT",
      categoryId: input.categoryId,
      images: input.images?.length
        ? { create: input.images.map((img, i) => ({ url: img.url, alt: img.alt, position: img.position ?? i })) }
        : undefined,
      variants: {
        create: input.variants.map((v) => ({
          sku: v.sku,
          name: v.name,
          priceMinor: v.priceMinor,
          currency: v.currency ?? "INR",
          barcode: v.barcode,
        })),
      },
    },
    include: productInclude,
  });
}
