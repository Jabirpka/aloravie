"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/components/AdminAuthProvider";
import { listReviews, setReviewStatus } from "@/lib/api";
import type { ReviewRecord } from "@/lib/types";

export default function ReviewsPage() {
  const { user, loading } = useAuth();
  const [filter, setFilter] = useState<"ALL" | "PUBLISHED" | "HIDDEN">("ALL");
  const [rows, setRows] = useState<ReviewRecord[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      setRows(await listReviews(filter === "ALL" ? undefined : filter));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [filter]);

  useEffect(() => {
    if (loading || !user) return;
    void load();
  }, [user, loading, load]);

  async function toggle(r: ReviewRecord) {
    setError(null);
    try {
      await setReviewStatus(r.id, r.status === "PUBLISHED" ? "HIDDEN" : "PUBLISHED");
      await load();
    } catch {
      setError("Couldn't update the review.");
    }
  }

  return (
    <Shell title="Reviews">
      <div className="filters">
        {(["ALL", "PUBLISHED", "HIDDEN"] as const).map((s) => (
          <button key={s} className={`chip ${filter === s ? "active" : ""}`} onClick={() => setFilter(s)}>
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}
      <div className="card">
        <div className="table-wrap">
          {state === "loading" && <div className="empty">Loading…</div>}
          {state === "error" && <div className="empty">Couldn&rsquo;t load reviews.</div>}
          {state === "ready" &&
            (rows.length === 0 ? (
              <div className="empty">No reviews in this view.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Product</th><th>Rating</th><th>Review</th><th>By</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="strong">{r.product.title}</td>
                      <td style={{ color: "var(--accent)", whiteSpace: "nowrap" }}>{"★".repeat(r.rating)}<span style={{ color: "var(--line)" }}>{"★".repeat(5 - r.rating)}</span></td>
                      <td>{r.title && <div className="strong">{r.title}</div>}<div className="muted">{r.body ?? "—"}</div></td>
                      <td>{r.customer.name ?? r.customer.email ?? "—"}{r.verifiedPurchase && <div className="muted" style={{ fontSize: 11 }}>✓ verified</div>}</td>
                      <td><span className={`pill ${r.status === "PUBLISHED" ? "ok" : "cancelled"}`}>{r.status}</span></td>
                      <td><button className="btn sm" onClick={() => toggle(r)}>{r.status === "PUBLISHED" ? "Hide" : "Publish"}</button></td>
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
