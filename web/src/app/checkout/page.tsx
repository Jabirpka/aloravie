"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import { formatMoney } from "@/lib/money";
import type { Address, AddressInput } from "@/lib/types";
import {
  ApiRequestError,
  confirmMockPayment,
  createCheckout,
  listAddresses,
  verifyRazorpayPayment,
} from "@/lib/client";

interface RazorpayHandlerResponse {
  razorpay_payment_id: string;
  razorpay_signature: string;
  razorpay_order_id: string;
}
interface RazorpayInstance {
  open: () => void;
  on: (event: string, cb: () => void) => void;
}
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const FREE_SHIP_MINOR = 149900;
const SHIP_FLAT_MINOR = 9900;

// Mirrors backend GST slabs for a live estimate; the server total is authoritative.
function gstFor(unitPriceMinor: number): number {
  return unitPriceMinor <= 100000 ? 0.05 : 0.12;
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const EMPTY_ADDRESS: AddressInput = {
  name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
};

export default function CheckoutPage() {
  const { customer, loading } = useAuth();
  const { lines, subtotalMinor, currency, count, clear } = useCart();
  const router = useRouter();

  const [address, setAddress] = useState<AddressInput>(EMPTY_ADDRESS);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Address[]>([]);
  const [selected, setSelected] = useState<string>("new"); // address id or "new"

  useEffect(() => {
    if (loading || !customer) return;
    listAddresses()
      .then((list) => {
        setSaved(list);
        const def = list.find((a) => a.isDefault) ?? list[0];
        if (def) setSelected(def.id);
      })
      .catch(() => {
        /* ignore */
      });
  }, [customer, loading]);

  const taxMinor = useMemo(
    () => lines.reduce((sum, l) => sum + Math.round(l.priceMinor * l.quantity * gstFor(l.priceMinor)), 0),
    [lines],
  );
  const shippingMinor = subtotalMinor >= FREE_SHIP_MINOR ? 0 : SHIP_FLAT_MINOR;
  const totalMinor = subtotalMinor + taxMinor + shippingMinor;

  function update(field: keyof AddressInput, value: string) {
    setAddress((a) => ({ ...a, [field]: value }));
  }

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const chosen = selected !== "new" ? saved.find((a) => a.id === selected) : undefined;
      const res = await createCheckout(
        lines,
        chosen
          ? { shippingAddressId: chosen.id, email: email || undefined }
          : { shippingAddress: address, email: email || undefined },
      );
      const contactName = chosen?.name ?? address.name;
      const contactPhone = chosen?.phone ?? address.phone;

      if (res.payment.provider === "MOCK") {
        const order = await confirmMockPayment(res.order.id);
        clear();
        router.push(`/order/${order.orderNumber}`);
        return;
      }

      const ready = await loadRazorpay();
      if (!ready || !window.Razorpay) throw new Error("Could not load the payment window. Please try again.");

      const rzp = new window.Razorpay({
        key: res.payment.razorpayKeyId,
        amount: res.payment.amountMinor,
        currency: res.payment.currency,
        order_id: res.payment.providerOrderId,
        name: "Aloravie",
        description: `Order ${res.order.orderNumber}`,
        prefill: { name: contactName, email, contact: contactPhone },
        theme: { color: "#C8714F" },
        handler: async (r: RazorpayHandlerResponse) => {
          try {
            const order = await verifyRazorpayPayment({
              orderId: res.order.id,
              razorpayPaymentId: r.razorpay_payment_id,
              razorpaySignature: r.razorpay_signature,
            });
            clear();
            router.push(`/order/${order.orderNumber}`);
          } catch {
            setError("We couldn't verify your payment. If you were charged, contact support with your order number.");
            setBusy(false);
          }
        },
      } as Record<string, unknown>);
      rzp.on("payment.failed", () => {
        setError("Payment failed or was cancelled. You can try again.");
        setBusy(false);
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : err instanceof Error ? err.message : "Checkout failed.");
      setBusy(false);
    }
  }

  if (loading) return <section className="container section"><p className="muted">Loading…</p></section>;

  if (!customer) {
    return (
      <section className="container section narrow">
        <p className="eyebrow">Checkout</p>
        <h1 className="checkout-h">Sign in to continue</h1>
        <p className="muted">You need an account to place an order and track it.</p>
        <Link href="/account?next=/checkout" className="btn primary">Sign in or create account</Link>
      </section>
    );
  }

  if (count === 0) {
    return (
      <section className="container section narrow">
        <p className="eyebrow">Checkout</p>
        <h1 className="checkout-h">Your bag is empty</h1>
        <Link href="/shop" className="btn primary">Start shopping</Link>
      </section>
    );
  }

  return (
    <section className="container section">
      <p className="eyebrow">Checkout</p>
      <h1 className="checkout-h">Shipping &amp; payment</h1>

      <div className="checkout-grid">
        <form className="checkout-form" onSubmit={placeOrder}>
          <h2 className="checkout-sub">Shipping address</h2>

          {saved.length > 0 && (
            <div className="addr-picker">
              {saved.map((a) => (
                <label key={a.id} className={`addr-option ${selected === a.id ? "sel" : ""}`}>
                  <input type="radio" name="addr" checked={selected === a.id} onChange={() => setSelected(a.id)} />
                  <span><span className="strong">{a.name}</span> — {a.line1}, {a.city}, {a.state} {a.pincode}</span>
                </label>
              ))}
              <label className={`addr-option ${selected === "new" ? "sel" : ""}`}>
                <input type="radio" name="addr" checked={selected === "new"} onChange={() => setSelected("new")} />
                <span>Use a new address</span>
              </label>
            </div>
          )}

          {selected === "new" && (
            <div className="field-grid">
              <label className="full"><span>Full name</span>
                <input value={address.name} onChange={(e) => update("name", e.target.value)} required autoComplete="name" />
              </label>
              <label><span>Phone</span>
                <input value={address.phone} onChange={(e) => update("phone", e.target.value)} required autoComplete="tel" />
              </label>
              <label className="full"><span>Address line 1</span>
                <input value={address.line1} onChange={(e) => update("line1", e.target.value)} required autoComplete="address-line1" />
              </label>
              <label className="full"><span>Address line 2 (optional)</span>
                <input value={address.line2} onChange={(e) => update("line2", e.target.value)} autoComplete="address-line2" />
              </label>
              <label><span>City</span>
                <input value={address.city} onChange={(e) => update("city", e.target.value)} required autoComplete="address-level2" />
              </label>
              <label><span>State</span>
                <input value={address.state} onChange={(e) => update("state", e.target.value)} required autoComplete="address-level1" />
              </label>
              <label><span>PIN code</span>
                <input value={address.pincode} onChange={(e) => update("pincode", e.target.value)} required inputMode="numeric" pattern="\d{6}" title="6-digit PIN code" autoComplete="postal-code" />
              </label>
            </div>
          )}

          <label className="full" style={{ display: "block", marginTop: 12 }}>
            <span className="muted" style={{ fontSize: 13 }}>Email for updates (optional)</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" style={{ width: "100%", marginTop: 6, padding: "11px 13px", border: "1px solid var(--line)", borderRadius: 4, background: "var(--bg)", color: "var(--text)" }} />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button className="btn primary place-order" type="submit" disabled={busy}>
            {busy ? "Processing…" : `Place order · ${formatMoney(totalMinor, currency)}`}
          </button>
        </form>

        <aside className="checkout-summary">
          <h2 className="checkout-sub">Order summary</h2>
          <ul className="summary-lines">
            {lines.map((l) => (
              <li key={l.variantId}>
                <span>{l.productTitle} <small className="muted">×{l.quantity}</small></span>
                <span>{formatMoney(l.priceMinor * l.quantity, l.currency)}</span>
              </li>
            ))}
          </ul>
          <div className="summary-row"><span>Subtotal</span><span>{formatMoney(subtotalMinor, currency)}</span></div>
          <div className="summary-row"><span>GST (est.)</span><span>{formatMoney(taxMinor, currency)}</span></div>
          <div className="summary-row"><span>Shipping</span><span>{shippingMinor === 0 ? "Free" : formatMoney(shippingMinor, currency)}</span></div>
          <div className="summary-row total"><span>Total</span><span>{formatMoney(totalMinor, currency)}</span></div>
        </aside>
      </div>
    </section>
  );
}
