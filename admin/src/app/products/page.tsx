"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/components/AdminAuthProvider";
import { listProducts, updateProductStatus, ApiRequestError } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import type { AdminProduct, ProductStatus } from "@/lib/types";

const CYCLE: Record<ProductStatus, ProductStatus> = {
  DRAFT: "ACTIVE",
  ACTIVE: "ARCHIVED",
  ARCHIVED: "ACTIVE",
};

function priceRange(p: AdminProduct): string {
  if (p.variants.length === 0) return "—";
  const prices = p.variants.map((v) => v.priceMinor);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const cur = p.variants[0]!.currency;
  return min === max ? formatMoney(min, cur) : `${formatMoney(min, cur)} – ${formatMoney(max, cur)}`;
}

export default function ProductsPage() {
  const { user, loading } = useAuth();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setProducts(await listProducts());
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    void load();
  }, [user, loading, load]);

  async function cycleStatus(p: AdminProduct) {
    setError(null);
    setBusyId(p.id);
    try {
      await updateProductStatus(p.id, CYCLE[p.status]);
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't update the product.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Shell title="Products">
      {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}
      <div className="card">
        <div className="table-wrap">
          {state === "loading" && <div className="empty">Loading…</div>}
          {state === "error" && <div className="empty">Couldn&rsquo;t load products.</div>}
          {state === "ready" &&
            (products.length === 0 ? (
              <div className="empty">No products yet. Seed the database or add one via the API.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Product</th><th>Category</th><th className="num">Variants</th><th>Price</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="strong">{p.title}<div className="muted" style={{ fontWeight: 400 }}>{p.slug}</div></td>
                      <td>{p.category?.name ?? "—"}</td>
                      <td className="num">{p.variants.length}</td>
                      <td>{priceRange(p)}</td>
                      <td><span className={`pill ${p.status.toLowerCase()}`}>{p.status}</span></td>
                      <td>
                        <button className="btn sm" disabled={busyId === p.id} onClick={() => cycleStatus(p)}>
                          {busyId === p.id ? "…" : p.status === "ACTIVE" ? "Archive" : "Make active"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
        </div>
      </div>
    </Shell>
  );
}
