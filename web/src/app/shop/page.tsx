import Link from "next/link";
import type { Metadata } from "next";
import { getProducts } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";

export const metadata: Metadata = { title: "Shop" };

const CATEGORIES = [
  { slug: "", name: "All" },
  { slug: "kurtas", name: "Kurtas" },
  { slug: "dresses", name: "Dresses" },
  { slug: "sarees", name: "Sarees" },
  { slug: "accessories", name: "Accessories" },
];

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { products, source } = await getProducts();
  const { category } = await searchParams;
  const activeCategory = category ?? "";
  const filtered = activeCategory
    ? products.filter((p) => p.category?.slug === activeCategory)
    : products;

  const activeName = CATEGORIES.find((c) => c.slug === activeCategory)?.name ?? "All";

  return (
    <section className="container section">
      <div className="shop-head">
        <p className="eyebrow">Shop</p>
        <h1 className="shop-title">{activeName}</h1>
        <p className="muted">{filtered.length} {filtered.length === 1 ? "piece" : "pieces"}</p>
      </div>

      <nav className="shop-filters" aria-label="Categories">
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug || "all"}
            href={c.slug ? `/shop?category=${c.slug}` : "/shop"}
            className={`filter-chip ${c.slug === activeCategory ? "active" : ""}`}
          >
            {c.name}
          </Link>
        ))}
      </nav>

      {filtered.length === 0 ? (
        <p className="muted empty-cat">No pieces in this category yet. <Link href="/shop" className="section-link">See everything →</Link></p>
      ) : (
        <div className="product-grid">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      {source === "sample" && (
        <p className="sample-note">
          Showing a sample catalogue — connect the backend database to see live products.
        </p>
      )}
    </section>
  );
}
