import Link from "next/link";
import { getProducts } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";
import { toneForSlug } from "@/lib/placeholder";

const CATEGORIES = [
  { slug: "kurtas", name: "Kurtas" },
  { slug: "dresses", name: "Dresses" },
  { slug: "sarees", name: "Sarees" },
  { slug: "accessories", name: "Accessories" },
];

export default async function HomePage() {
  const { products, source } = await getProducts();
  const featured = products.slice(0, 8);

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">New Collection · Autumn &rsquo;26</p>
            <h1 className="hero-h">
              Made for slow mornings and <b>first light</b>.
            </h1>
            <p className="hero-tagline">Dressed up in first light</p>
            <div className="hero-cta">
              <Link href="/shop" className="btn primary">Shop new in</Link>
              <Link href="/shop?category=sarees" className="btn ghost">The handloom edit</Link>
            </div>
          </div>
          <div className="hero-card" aria-hidden="true">
            <div className="hero-card-tag">
              <small>Featured</small>Aurora Handloom Edit
            </div>
          </div>
        </div>
      </section>

      <section className="container cat-strip">
        {CATEGORIES.map((c) => (
          <Link key={c.slug} href={`/shop?category=${c.slug}`} className="cat-tile">
            <div className="cat-swatch" style={{ background: toneForSlug(c.slug) }} />
            <span>{c.name}</span>
          </Link>
        ))}
      </section>

      <section className="container section">
        <div className="section-head">
          <h2>New in this week</h2>
          <Link href="/shop" className="section-link">View all →</Link>
        </div>
        <div className="product-grid">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        {source === "sample" && (
          <p className="sample-note">
            Showing a sample catalogue — connect the backend database to see live products.
          </p>
        )}
      </section>

      <section className="system-band">
        <div className="container">
          <h2>One brand, one system.</h2>
          <p className="system-sub">
            Every order placed here flows into the same back office that runs the warehouse, the marketplaces
            and the courier — so stock, invoices and tracking stay in step.
          </p>
          <div className="system-feats">
            <div className="feat"><h3>Live inventory</h3><p>One stock pool across the web store and marketplaces.</p></div>
            <div className="feat"><h3>Orders &amp; tracking</h3><p>Placed to delivered in one timeline, with courier updates.</p></div>
            <div className="feat"><h3>Invoices &amp; labels</h3><p>GST invoice, delivery note and shipping label on pack.</p></div>
            <div className="feat"><h3>Customer care</h3><p>Chat, order help and WhatsApp alerts, tied to each customer.</p></div>
          </div>
        </div>
      </section>
    </>
  );
}
