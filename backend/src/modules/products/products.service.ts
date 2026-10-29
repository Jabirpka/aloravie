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
  // `stock`, when given, seeds opening inventory for the variant at the default
  // location so the product is immediately sellable without a separate step.
  variants: { sku: string; name: string; priceMinor: number; currency?: string; barcode?: string; stock?: number }[];
}

export async function createProduct(input: CreateProductInput) {
  const existing = await prisma.product.findUnique({ where: { slug: input.slug } });
  if (existing) throw conflict(`A product with slug "${input.slug}" already exists`);

  // The location where opening stock lands (same default the checkout reserves from).
  let location = await prisma.location.findFirst({ where: { isDefault: true } });
  if (!location) location = await prisma.location.findFirst();
  const loc = location;

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
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

    // Seed opening stock for any variant that came with a quantity.
    if (loc) {
      const bySku = new Map(product.variants.map((v) => [v.sku, v.id]));
      for (const v of input.variants) {
        if (v.stock != null && v.stock > 0) {
          const variantId = bySku.get(v.sku);
          if (variantId) {
            await tx.inventoryItem.create({
              data: { variantId, locationId: loc.id, onHand: v.stock, reserved: 0 },
            });
          }
        }
      }
    }

    return product;
  });
}
