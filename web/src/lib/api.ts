// Storefront data access. Talks to the Aloravie backend; falls back to the bundled
// sample catalog when the API is unreachable (e.g. before Postgres is running),
// so the shop always renders during development.
import type { Product } from "./types";
import { SAMPLE_PRODUCTS } from "./sample";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type DataSource = "api" | "sample";

export interface ProductsResult {
  products: Product[];
  source: DataSource;
}

export interface ProductResult {
  product: Product | null;
  source: DataSource;
}

export async function getProducts(): Promise<ProductsResult> {
  try {
    const res = await fetch(`${API_URL}/api/products?status=ACTIVE`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = (await res.json()) as { products?: Product[] };
    if (!data.products || data.products.length === 0) throw new Error("empty catalog");
    return { products: data.products, source: "api" };
  } catch {
    return { products: SAMPLE_PRODUCTS, source: "sample" };
  }
}

export async function getProduct(slug: string): Promise<ProductResult> {
  try {
    const res = await fetch(`${API_URL}/api/products/${encodeURIComponent(slug)}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = (await res.json()) as { product?: Product };
    if (!data.product) throw new Error("not found");
    return { product: data.product, source: "api" };
  } catch {
    const product = SAMPLE_PRODUCTS.find((p) => p.slug === slug) ?? null;
    return { product, source: "sample" };
  }
}
