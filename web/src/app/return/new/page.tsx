"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { formatMoney } from "@/lib/money";
import type { Order, ReturnReason } from "@/lib/types";
import { ApiRequestError, createReturn, getOrder } from "@/lib/client";

const REASONS: { value: ReturnReason; label: string }[] = [
  { value: "WRONG_SIZE", label: "Wrong size / fit" },
  { value: "DAMAGED", label: "Damaged or defective" },
  { value: "NOT_AS_DESCRIBED", label: "Not as described" },
  { value: "CHANGED_MIND", label: "Changed my mind" },
  { value: "OTHER", label: "Other" },
];

function ReturnForm() {
  const params = useSearchParams();
  const orderNumber = params.get("order") ?? "";
  const { customer, loading } = useAuth();
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReturnReason>("WRONG_SIZE");
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !customer || !orderNumber) return;
    getOrder(orderNumber).then(setOrder).catch(() => setError("Couldn't load that order."));
  }, [orderNumber, customer, loading]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;
    const items = Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
    if (items.length === 0) {
      setError("Choose at least one item and quantity to return.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("orderId", order.id);
      form.set("reason", reason);
      if (comment) form.set("comment", comment);
      form.set("items", JSON.stringify(items));
      photos.forEach((p) => form.append("photos", p));
      await createReturn(form);
      router.push("/account/returns");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't submit the return.");
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;
  if (!customer) {
    return (
      <>
        <h1 className="checkout-h">Sign in</h1>
        <Link href={`/account?next=/return/new?order=${orderNumber}`} className="btn primary">Sign in</Link>
      </>
    );
  }
  if (!order) return <p className="muted">{error ?? "Loading your order…"}</p>;

  return (
    <>
      <Link href={`/order/${order.orderNumber}`} className="back-link">← Order {order.orderNumber}</Link>
      <p className="eyebrow">Returns</p>
      <h1 className="checkout-h">Request a return</h1>

      <form onSubmit={submit}>
        <h2 className="checkout-sub">What are you returning?</h2>
        <div className="return-items">
          {order.items.map((it) => (
            <div key={it.id} className="return-item">
              <div>
                <div className="strong">{it.titleSnapshot}</div>
                <div className="muted">{it.skuSnapshot} · ordered {it.quantity} · {formatMoney(it.unitPriceMinor, order.currency)}</div>
              </div>
              <select value={qty[it.id] ?? 0} onChange={(e) => setQty((s) => ({ ...s, [it.id]: Number(e.target.value) }))}>
                {Array.from({ length: it.quantity + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          ))}
        </div>

        <h2 className="checkout-sub" style={{ marginTop: 22 }}>Reason</h2>
        <select className="return-reason" value={reason} onChange={(e) => setReason(e.target.value as ReturnReason)}>
          {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>

        <label style={{ display: "block", marginTop: 16 }}>
          <span className="muted" style={{ fontSize: 13 }}>Anything else? (optional)</span>
          <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} style={{ width: "100%", marginTop: 6 }} />
        </label>

        <label style={{ display: "block", marginTop: 16 }}>
          <span className="muted" style={{ fontSize: 13 }}>Photos (optional, up to 5) — helps us process damage claims faster</span>
          <input type="file" accept="image/*" multiple style={{ display: "block", marginTop: 6 }}
            onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, 5))} />
        </label>
        {photos.length > 0 && <p className="muted" style={{ fontSize: 12 }}>{photos.length} photo{photos.length === 1 ? "" : "s"} selected</p>}

        {error && <p className="form-error">{error}</p>}
        <button className="btn primary" type="submit" disabled={busy} style={{ marginTop: 18 }}>
          {busy ? "Submitting…" : "Submit return request"}
        </button>
      </form>
    </>
  );
}

export default function ReturnNewPage() {
  return (
    <section className="container section narrow">
      <Suspense fallback={<p className="muted">Loading…</p>}>
        <ReturnForm />
      </Suspense>
    </section>
  );
}
