import type { ProductStatus } from "@prisma/client";
import { prisma } from "../../prisma.js";
import { conflict, notFound } from "../../lib/http.js";
import { toCsv, parseCsv } from "../../lib/csv.js";

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

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

const CSV_HEADER = ["title", "slug", "description", "category_slug", "status", "variant_name", "sku", "price", "stock", "images"];

/** Export the whole catalogue as CSV — one row per variant. Price is GST-inclusive rupees. */
export async function exportProductsCsv(): Promise<string> {
  const products = await prisma.product.findMany({
    include: { category: true, images: { orderBy: { position: "asc" } }, variants: { orderBy: { createdAt: "asc" } } },
    orderBy: { title: "asc" },
  });
  let location = await prisma.location.findFirst({ where: { isDefault: true } });
  if (!location) location = await prisma.location.findFirst();
  const variantIds = products.flatMap((p) => p.variants.map((v) => v.id));
  const inv =
    location && variantIds.length
      ? await prisma.inventoryItem.findMany({ where: { locationId: location.id, variantId: { in: variantIds } } })
      : [];
  const stockBy = new Map(inv.map((i) => [i.variantId, i.onHand]));

  const rows: (string | number)[][] = [CSV_HEADER];
  for (const p of products) {
    const images = p.images.map((i) => i.url).join(";");
    for (const v of p.variants) {
      rows.push([
        p.title, p.slug, p.description ?? "", p.category?.slug ?? "", p.status,
        v.name, v.sku, (v.priceMinor / 100).toFixed(2), String(stockBy.get(v.id) ?? 0), images,
      ]);
    }
  }
  return toCsv(rows);
}

/** Import products from CSV (same columns as the export). Existing slugs are skipped, not overwritten. */
export async function importProductsCsv(csv: string): Promise<{ created: number; skipped: number; errors: string[] }> {
  const rows = parseCsv(csv).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length < 2) return { created: 0, skipped: 0, errors: ["No data rows found."] };
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const col = (r: string[], name: string) => {
    const i = header.indexOf(name);
    return i >= 0 ? (r[i] ?? "").trim() : "";
  };

  // Group variant rows by product slug.
  const grouped = new Map<string, { title: string; slug: string; description: string; category_slug: string; status: string; variants: { name: string; sku: string; price: string; stock: string; images: string }[] }>();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]!;
    const slug = col(r, "slug") || slugify(col(r, "title"));
    if (!slug) continue;
    if (!grouped.has(slug)) {
      grouped.set(slug, { title: col(r, "title"), slug, description: col(r, "description"), category_slug: col(r, "category_slug"), status: col(r, "status"), variants: [] });
    }
    grouped.get(slug)!.variants.push({ name: col(r, "variant_name") || "One size", sku: col(r, "sku"), price: col(r, "price"), stock: col(r, "stock"), images: col(r, "images") });
  }

  const cats = await prisma.category.findMany({ select: { id: true, slug: true } });
  const catBy = new Map(cats.map((c) => [c.slug, c.id]));

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const [slug, p] of grouped) {
    try {
      if (await prisma.product.findUnique({ where: { slug } })) { skipped++; continue; }
      const imageStr = p.variants.find((v) => v.images)?.images ?? "";
      const images = imageStr.split(";").map((s) => s.trim()).filter(Boolean).map((url) => ({ url }));
      const variants = p.variants.map((v, i) => ({
        name: v.name,
        sku: (v.sku || `${slug}-${i + 1}`).toUpperCase(),
        priceMinor: Math.round(Number(v.price) * 100),
        stock: v.stock ? Math.max(0, Math.round(Number(v.stock))) : 0,
      }));
      if (variants.some((v) => !Number.isFinite(v.priceMinor) || v.priceMinor <= 0)) {
        errors.push(`${slug}: every variant needs a price > 0`);
        continue;
      }
      const statusUpper = p.status.toUpperCase();
      const status = (["DRAFT", "ACTIVE", "ARCHIVED"].includes(statusUpper) ? statusUpper : "ACTIVE") as ProductStatus;
      await createProduct({
        title: p.title || slug,
        slug,
        description: p.description || undefined,
        status,
        categoryId: catBy.get(p.category_slug) || undefined,
        images: images.length ? images : undefined,
        variants,
      });
      created++;
    } catch (err) {
      errors.push(`${slug}: ${err instanceof Error ? err.message : "failed"}`);
    }
  }
  return { created, skipped, errors };
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
