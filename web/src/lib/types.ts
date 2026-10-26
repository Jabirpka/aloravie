// Shapes returned by the Aloravie backend API (subset used by the storefront).

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string | null;
  position: number;
}

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  priceMinor: number;
  currency: string;
}

export interface Product {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  category: Category | null;
  images: ProductImage[];
  variants: ProductVariant[];
}

// A line in the shopping bag (client-side).
export interface CartLine {
  variantId: string;
  productSlug: string;
  productTitle: string;
  variantName: string;
  priceMinor: number;
  currency: string;
  quantity: number;
}
