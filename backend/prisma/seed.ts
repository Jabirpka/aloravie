// Seed baseline data: default location, sales channels, a few on-brand products.
// Run with: npm run db:seed  (requires a migrated database)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Default warehouse / location
  const location = await prisma.location.upsert({
    where: { code: "MAIN" },
    update: {},
    create: { name: "Main Warehouse", code: "MAIN", isDefault: true },
  });

  // Sales channels — web plus the marketplaces we plan to sync
  const channels: { type: "WEB" | "AMAZON" | "FLIPKART" | "MYNTRA" | "MEESHO"; name: string }[] = [
    { type: "WEB", name: "Aloravie Web Store" },
    { type: "AMAZON", name: "Amazon.in" },
    { type: "FLIPKART", name: "Flipkart" },
    { type: "MYNTRA", name: "Myntra" },
    { type: "MEESHO", name: "Meesho" },
  ];
  for (const ch of channels) {
    await prisma.salesChannel.upsert({
      where: { type: ch.type },
      update: { name: ch.name },
      create: ch,
    });
  }

  // Categories
  const kurtas = await prisma.category.upsert({
    where: { slug: "kurtas" },
    update: {},
    create: { name: "Kurtas", slug: "kurtas" },
  });
  const dresses = await prisma.category.upsert({
    where: { slug: "dresses" },
    update: {},
    create: { name: "Dresses", slug: "dresses" },
  });

  // A couple of on-brand products (prices in paise)
  const products = [
    {
      title: "Aurora Cotton Kurta",
      slug: "aurora-cotton-kurta",
      description: "Hand block-print cotton kurta in terracotta. Made for slow mornings.",
      categoryId: kurtas.id,
      status: "ACTIVE" as const,
      // Placeholder 3D model to demo the viewer; swap for the garment's own GLB.
      model3dUrl: "https://modelviewer.dev/shared-assets/models/Astronaut.glb",
      variants: [
        { sku: "ALV-AURORA-S", name: "S / Terracotta", priceMinor: 189000 },
        { sku: "ALV-AURORA-M", name: "M / Terracotta", priceMinor: 189000 },
        { sku: "ALV-AURORA-L", name: "L / Terracotta", priceMinor: 189000 },
      ],
    },
    {
      title: "First Light Linen Dress",
      slug: "first-light-linen-dress",
      description: "Sand-toned linen midi dress for warm days and first light.",
      categoryId: dresses.id,
      status: "ACTIVE" as const,
      variants: [
        { sku: "ALV-FLLD-S", name: "S / Sand", priceMinor: 275000 },
        { sku: "ALV-FLLD-M", name: "M / Sand", priceMinor: 275000 },
      ],
    },
  ];

  for (const p of products) {
    const model3dUrl = (p as { model3dUrl?: string }).model3dUrl;
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: { title: p.title, description: p.description, status: p.status, categoryId: p.categoryId, model3dUrl },
      create: {
        title: p.title,
        slug: p.slug,
        description: p.description,
        status: p.status,
        categoryId: p.categoryId,
        model3dUrl,
        variants: { create: p.variants },
      },
      include: { variants: true },
    });

    // Seed some stock for each variant at the main location.
    for (const variant of product.variants) {
      await prisma.inventoryItem.upsert({
        where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
        update: {},
        create: { variantId: variant.id, locationId: location.id, onHand: 25, reserved: 0 },
      });
    }
  }

  console.log("Seed complete: location, channels, categories, products and stock.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
