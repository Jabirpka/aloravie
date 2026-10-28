"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useWishlist } from "@/components/WishlistProvider";
import { ProductCard } from "@/components/ProductCard";
import { listWishlist } from "@/lib/client";
import type { Product } from "@/lib/types";

export default function WishlistPage() {
  const { customer, loading } = useAuth();
  const { ids } = useWishlist();
  const [products, setProducts] = useState<Product[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  // Reload whenever the saved set changes (e.g. after un-hearting a card here).
  useEffect(() => {
    if (loading || !customer) return;
    listWishlist()
      .then((p) => {
        setProducts(p);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [customer, loading, ids]);

  if (loading || state === "loading")
    return <section className="container section"><p className="muted">Loading…</p></section>;

  if (!customer) {
    return (
      <section className="container section narrow">
        <h1 className="checkout-h">Sign in</h1>
        <Link href="/account?next=/account/wishlist" className="btn primary">Sign in</Link>
      </section>
    );
  }

  return (
    <section className="container section">
      <p className="eyebrow">Your account</p>
      <h1 className="checkout-h">Wishlist</h1>
      {state === "error" ? (
        <p className="muted">Couldn&rsquo;t load your wishlist.</p>
      ) : products.length === 0 ? (
        <p className="muted">
          Nothing saved yet. Tap the heart on anything you love in the{" "}
          <Link href="/shop">shop</Link>.
        </p>
      ) : (
        <div className="product-grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}
