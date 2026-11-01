import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/api";
import { AddToBag } from "@/components/AddToBag";
import { WishlistButton } from "@/components/WishlistButton";
import { ProductGallery } from "@/components/ProductGallery";
import { ShareButton } from "@/components/ShareButton";
import { ReviewsSection } from "@/components/ReviewsSection";
import { toneForSlug } from "@/lib/placeholder";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { product } = await getProduct(slug);
  if (!product) return { title: "Not found" };
  return {
    title: product.title,
    description: product.description ?? undefined,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { product, source } = await getProduct(slug);
  if (!product) notFound();

  return (
    <section className="container section">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/shop">Shop</Link>
        {product.category && (
          <>
            <span aria-hidden="true"> / </span>
            <Link href={`/shop?category=${product.category.slug}`}>{product.category.name}</Link>
          </>
        )}
        <span aria-hidden="true"> / </span>
        <span className="muted">{product.title}</span>
      </nav>

      <div className="pdp">
        <ProductGallery
          images={product.images}
          model3dUrl={product.model3dUrl}
          title={product.title}
          tone={toneForSlug(product.slug)}
        />

        <div className="pdp-info">
          {product.category && <p className="eyebrow">{product.category.name}</p>}
          <h1 className="pdp-title">{product.title}</h1>
          {product.description && <p className="pdp-desc">{product.description}</p>}

          <AddToBag product={product} />

          <div className="pdp-wishlist">
            <WishlistButton productId={product.id} slug={product.slug} />
            <span className="muted">Save to wishlist</span>
            <ShareButton title={product.title} />
          </div>

          <ul className="pdp-details">
            <li>Free shipping on orders over ₹1,499</li>
            <li>7-day easy returns</li>
            <li>Made in India</li>
          </ul>
        </div>
      </div>

      {source === "sample" && (
        <p className="sample-note">Sample product — connect the backend database to serve live detail.</p>
      )}

      <ReviewsSection slug={product.slug} />
    </section>
  );
}
