"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";
import { formatMoney } from "@/lib/money";

const FREE_SHIP_MINOR = 149900; // ₹1,499

export function CartView() {
  const { lines, subtotalMinor, currency, setQuantity, removeLine, count } = useCart();

  if (count === 0) {
    return (
      <div className="cart-empty">
        <p className="eyebrow">Your bag</p>
        <h1 className="cart-empty-h">Nothing here yet.</h1>
        <p className="muted">Pieces you add will wait for you here.</p>
        <Link href="/shop" className="btn primary">Start shopping</Link>
      </div>
    );
  }

  const shipMinor = subtotalMinor >= FREE_SHIP_MINOR ? 0 : 9900;
  const totalMinor = subtotalMinor + shipMinor;

  return (
    <div className="cart-grid">
      <div className="cart-lines">
        {lines.map((l) => (
          <div key={l.variantId} className="cart-line">
            <div>
              <Link href={`/product/${l.productSlug}`} className="cart-line-title">
                {l.productTitle}
              </Link>
              <div className="muted cart-line-variant">{l.variantName}</div>
              <button className="link-btn danger" onClick={() => removeLine(l.variantId)}>
                Remove
              </button>
            </div>
            <div className="cart-qty">
              <button aria-label="Decrease quantity" onClick={() => setQuantity(l.variantId, l.quantity - 1)}>
                −
              </button>
              <span aria-live="polite">{l.quantity}</span>
              <button aria-label="Increase quantity" onClick={() => setQuantity(l.variantId, l.quantity + 1)}>
                +
              </button>
            </div>
            <div className="cart-line-price">{formatMoney(l.priceMinor * l.quantity, l.currency)}</div>
          </div>
        ))}
      </div>

      <aside className="cart-summary">
        <h2 className="cart-summary-h">Order summary</h2>
        <div className="summary-row">
          <span>Subtotal</span>
          <span>{formatMoney(subtotalMinor, currency)}</span>
        </div>
        <div className="summary-row">
          <span>Shipping</span>
          <span>{shipMinor === 0 ? "Free" : formatMoney(shipMinor, currency)}</span>
        </div>
        {shipMinor > 0 && (
          <p className="ship-hint muted">
            Add {formatMoney(FREE_SHIP_MINOR - subtotalMinor, currency)} more for free shipping.
          </p>
        )}
        <div className="summary-row total">
          <span>Total</span>
          <span>{formatMoney(totalMinor, currency)}</span>
        </div>
        <button className="btn primary checkout-btn" disabled title="Checkout arrives in Phase 2">
          Checkout — coming soon
        </button>
        <p className="muted checkout-note">Secure checkout with Razorpay (UPI, cards) lands in the next phase.</p>
      </aside>
    </div>
  );
}
