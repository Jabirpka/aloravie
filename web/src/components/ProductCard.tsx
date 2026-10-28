import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { toneForSlug } from "@/lib/placeholder";
import { WishlistButton } from "./WishlistButton";

function minPrice(product: Product): { priceMinor: number; currency: string } {
  const prices = product.variants.map((v) => v.priceMinor);
  const min = prices.length ? Math.min(...prices) : 0;
  return { priceMinor: min, currency: product.variants[0]?.currency ?? "INR" };
}

export function ProductCard({ product }: { product: Product }) {
  const { priceMinor, currency } = minPrice(product);
  const firstImage = product.images[0];

  return (
    <div className="product-card-wrap">
      <WishlistButton productId={product.id} slug={product.slug} overlay />
      <Link href={`/product/${product.slug}`} className="product-card">
        <div className="product-ph" style={firstImage ? undefined : { background: toneForSlug(product.slug) }}>
          {firstImage && <img src={firstImage.url} alt={firstImage.alt ?? product.title} />}
        </div>
        <div className="product-card-body">
          <div className="product-name">{product.title}</div>
          {product.category && <div className="product-meta">{product.category.name}</div>}
          <div className="product-price">{formatMoney(priceMinor, currency)}</div>
        </div>
      </Link>
    </div>
  );
}
