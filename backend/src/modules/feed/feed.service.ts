import { prisma } from "../../prisma.js";
import { env } from "../../env.js";

// Escape text for inclusion in XML element content.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Images are stored either as absolute URLs (S3/R2) or as a local /uploads path
// served on the storefront origin; Meta needs an absolute, fetchable URL.
function absoluteImage(url: string): string {
  return /^https?:\/\//.test(url) ? url : `${env.storefrontUrl}${url}`;
}

/**
 * Build a Google/Meta product feed (RSS 2.0 + g: namespace). Meta Commerce
 * Manager fetches this URL on a schedule to keep the Instagram/Facebook catalog
 * in sync. One item per product (shoppers pick the size on the product page).
 * Only ACTIVE products that have at least one photo are included — Meta rejects
 * items without an image.
 */
export async function buildMetaFeed(): Promise<string> {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: true,
      category: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Total on-hand per variant (summed across locations) → product availability.
  const variantIds = products.flatMap((p) => p.variants.map((v) => v.id));
  const inv = variantIds.length
    ? await prisma.inventoryItem.groupBy({
        by: ["variantId"],
        _sum: { onHand: true },
        where: { variantId: { in: variantIds } },
      })
    : [];
  const stockByVariant = new Map(inv.map((i) => [i.variantId, i._sum.onHand ?? 0]));

  const items = products
    .filter((p) => p.images.length > 0 && p.variants.length > 0)
    .map((p) => {
      const minPriceMinor = Math.min(...p.variants.map((v) => v.priceMinor));
      const currency = p.variants[0]!.currency;
      const inStock = p.variants.some((v) => (stockByVariant.get(v.id) ?? 0) > 0);
      const link = `${env.storefrontUrl}/product/${p.slug}`;
      const description = (p.description ?? p.title).slice(0, 5000);
      const extraImages = p.images
        .slice(1, 11)
        .map((img) => `      <g:additional_image_link>${esc(absoluteImage(img.url))}</g:additional_image_link>`)
        .join("\n");

      return [
        "    <item>",
        `      <g:id>${esc(p.id)}</g:id>`,
        `      <g:title>${esc(p.title)}</g:title>`,
        `      <g:description>${esc(description)}</g:description>`,
        `      <g:link>${esc(link)}</g:link>`,
        `      <g:image_link>${esc(absoluteImage(p.images[0]!.url))}</g:image_link>`,
        extraImages,
        `      <g:availability>${inStock ? "in stock" : "out of stock"}</g:availability>`,
        "      <g:condition>new</g:condition>",
        `      <g:price>${(minPriceMinor / 100).toFixed(2)} ${currency}</g:price>`,
        `      <g:brand>${esc(env.SELLER_NAME)}</g:brand>`,
        p.category ? `      <g:product_type>${esc(p.category.name)}</g:product_type>` : "",
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${esc(env.SELLER_NAME)} catalog</title>
    <link>${esc(env.storefrontUrl)}</link>
    <description>Product catalog for Meta / Instagram Shopping</description>
${items}
  </channel>
</rss>`;
}
