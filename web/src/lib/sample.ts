// Fallback catalog so the storefront renders before the backend DB is running.
// Mirrors the seed data; replaced by live API data the moment the backend serves it.
import type { Product } from "./types";

function cat(name: string, slug: string) {
  return { id: `cat-${slug}`, name, slug };
}

const KURTAS = cat("Kurtas", "kurtas");
const DRESSES = cat("Dresses", "dresses");
const SAREES = cat("Sarees", "sarees");
const ACCESSORIES = cat("Accessories", "accessories");

export const SAMPLE_CATEGORIES = [KURTAS, DRESSES, SAREES, ACCESSORIES];

export const SAMPLE_PRODUCTS: Product[] = [
  {
    id: "p-aurora",
    title: "Aurora Cotton Kurta",
    slug: "aurora-cotton-kurta",
    description:
      "A hand block-print cotton kurta in terracotta, cut easy for slow mornings. Breathable, lined at the yoke, with a soft mandarin collar.",
    status: "ACTIVE",
    category: KURTAS,
    images: [],
    // Placeholder 3D model to demonstrate the viewer; replace with the garment's own GLB.
    model3dUrl: "https://modelviewer.dev/shared-assets/models/Astronaut.glb",
    variants: [
      { id: "v-aurora-s", sku: "ALV-AURORA-S", name: "S / Terracotta", priceMinor: 189000, currency: "INR" },
      { id: "v-aurora-m", sku: "ALV-AURORA-M", name: "M / Terracotta", priceMinor: 189000, currency: "INR" },
      { id: "v-aurora-l", sku: "ALV-AURORA-L", name: "L / Terracotta", priceMinor: 189000, currency: "INR" },
    ],
  },
  {
    id: "p-firstlight",
    title: "First Light Linen Dress",
    slug: "first-light-linen-dress",
    description:
      "A sand-toned linen midi dress for warm days and first light. Side pockets, a tie waist, and a hem that moves.",
    status: "ACTIVE",
    category: DRESSES,
    images: [],
    variants: [
      { id: "v-fl-s", sku: "ALV-FLLD-S", name: "S / Sand", priceMinor: 275000, currency: "INR" },
      { id: "v-fl-m", sku: "ALV-FLLD-M", name: "M / Sand", priceMinor: 275000, currency: "INR" },
    ],
  },
  {
    id: "p-coord",
    title: "Terracotta Co-ord Set",
    slug: "terracotta-co-ord-set",
    description: "A two-piece mul cotton co-ord — relaxed shirt and wide trousers in warm terracotta.",
    status: "ACTIVE",
    category: KURTAS,
    images: [],
    variants: [
      { id: "v-coord-s", sku: "ALV-COORD-S", name: "S / Terracotta", priceMinor: 320000, currency: "INR" },
      { id: "v-coord-m", sku: "ALV-COORD-M", name: "M / Terracotta", priceMinor: 320000, currency: "INR" },
    ],
  },
  {
    id: "p-dupatta",
    title: "Dawn Mul Dupatta",
    slug: "dawn-mul-dupatta",
    description: "A featherlight cream mul dupatta with a hand-knotted tassel edge. Layers over everything.",
    status: "ACTIVE",
    category: ACCESSORIES,
    images: [],
    variants: [
      { id: "v-dupatta", sku: "ALV-DUP-CREAM", name: "One size / Cream", priceMinor: 125000, currency: "INR" },
    ],
  },
  {
    id: "p-saree",
    title: "Sand Handloom Saree",
    slug: "sand-handloom-saree",
    description: "Pure cotton handloom saree in sand with a cocoa border. Comes with an unstitched blouse piece.",
    status: "ACTIVE",
    category: SAREES,
    images: [],
    variants: [
      { id: "v-saree", sku: "ALV-SAREE-SAND", name: "5.5 m / Sand", priceMinor: 349000, currency: "INR" },
    ],
  },
  {
    id: "p-tote",
    title: "Morning Canvas Tote",
    slug: "morning-canvas-tote",
    description: "A sturdy clay canvas tote for everyday carry, with an inner pocket and the sun-dot embroidered inside.",
    status: "ACTIVE",
    category: ACCESSORIES,
    images: [],
    variants: [
      { id: "v-tote", sku: "ALV-TOTE-CLAY", name: "One size / Clay", priceMinor: 115000, currency: "INR" },
    ],
  },
  {
    id: "p-wrap",
    title: "Evening Cocoa Wrap Dress",
    slug: "evening-cocoa-wrap-dress",
    description: "A deep cocoa wrap dress for evenings, in a soft crepe with a sun-dot button at the waist.",
    status: "ACTIVE",
    category: DRESSES,
    images: [],
    variants: [
      { id: "v-wrap-s", sku: "ALV-WRAP-S", name: "S / Cocoa", priceMinor: 298000, currency: "INR" },
      { id: "v-wrap-m", sku: "ALV-WRAP-M", name: "M / Cocoa", priceMinor: 298000, currency: "INR" },
      { id: "v-wrap-l", sku: "ALV-WRAP-L", name: "L / Cocoa", priceMinor: 298000, currency: "INR" },
    ],
  },
  {
    id: "p-anarkali",
    title: "Clay Block-Print Anarkali",
    slug: "clay-block-print-anarkali",
    description: "A floor-length anarkali in clay with a fine block print, panelled for a gentle flare.",
    status: "ACTIVE",
    category: KURTAS,
    images: [],
    variants: [
      { id: "v-anar-m", sku: "ALV-ANAR-M", name: "M / Clay", priceMinor: 345000, currency: "INR" },
      { id: "v-anar-l", sku: "ALV-ANAR-L", name: "L / Clay", priceMinor: 345000, currency: "INR" },
    ],
  },
];
