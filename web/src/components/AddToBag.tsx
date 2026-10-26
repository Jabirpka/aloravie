"use client";

import { useState } from "react";
import type { Product } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { useCart } from "./CartProvider";

export function AddToBag({ product }: { product: Product }) {
  const { addLine } = useCart();
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const [added, setAdded] = useState(false);

  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  if (!variant) return <p className="muted">Currently unavailable.</p>;

  function add() {
    if (!variant) return;
    addLine({
      variantId: variant.id,
      productSlug: product.slug,
      productTitle: product.title,
      variantName: variant.name,
      priceMinor: variant.priceMinor,
      currency: variant.currency,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <div className="add-to-bag">
      <div className="price-lg">{formatMoney(variant.priceMinor, variant.currency)}</div>

      {product.variants.length > 1 && (
        <div className="variant-group" role="radiogroup" aria-label="Choose a size">
          {product.variants.map((v) => (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={v.id === variantId}
              className={`variant-chip ${v.id === variantId ? "selected" : ""}`}
              onClick={() => setVariantId(v.id)}
            >
              {v.name}
            </button>
          ))}
        </div>
      )}

      <button className="btn primary add-btn" onClick={add}>
        {added ? "Added to bag ✓" : "Add to bag"}
      </button>
    </div>
  );
}
