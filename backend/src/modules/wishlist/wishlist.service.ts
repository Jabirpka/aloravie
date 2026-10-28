import { prisma } from "../../prisma.js";
import { notFound } from "../../lib/http.js";

// Same shape the storefront product cards expect.
const productInclude = {
  category: true,
  images: { orderBy: { position: "asc" } },
  variants: { orderBy: { createdAt: "asc" } },
} as const;

export async function listWishlist(customerId: string) {
  const items = await prisma.wishlistItem.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: { product: { include: productInclude } },
  });
  return items.map((i) => i.product);
}

// Idempotent: adding a product already on the list is a no-op.
export async function addToWishlist(customerId: string, productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw notFound("Product not found");
  await prisma.wishlistItem.upsert({
    where: { customerId_productId: { customerId, productId } },
    update: {},
    create: { customerId, productId },
  });
}

export async function removeFromWishlist(customerId: string, productId: string) {
  await prisma.wishlistItem.deleteMany({ where: { customerId, productId } });
}
