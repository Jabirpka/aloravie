"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/components/AdminAuthProvider";
import { ApiRequestError, assetUrl, decideReturn, getReturn } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import type { ReturnRecord } from "@/lib/types";

const REASON: Record<string, string> = {
  WRONG_SIZE: "Wrong size / fit", DAMAGED: "Damaged or defective", NOT_AS_DESCRIBED: "Not as described",
  CHANGED_MIND: "Changed mind", OTHER: "Other",
};

export default function ReturnDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const [r, setR] = useState<ReturnRecord | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setR(await getReturn(params.id));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [params.id]);

  useEffect(() => {
    if (loading || !user) return;
    void load();
  }, [user, loading, load]);

  async function decide(action: "approve" | "reject" | "refund") {
    setBusy(true);
    setError(null);
    try {
      const message = action === "refund" ? undefined : note.trim() || undefined;
      setR(await decideReturn(params.id, action, message));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  const currency = r?.order?.currency ?? "INR";
  const total = r ? r.items.reduce((s, i) => s + i.unitPriceMinor * i.quantity, 0) : 0;

  return (
    <Shell title={r ? `Return · ${r.order?.orderNumber ?? ""}` : "Return"}>
      <Link href="/returns" className="back-link">← Returns</Link>
      {state === "loading" && <p className="muted">Loading…</p>}
      {state === "error" && <p className="muted">Return not found.</p>}
      {state === "ready" && r && (
        <>
          <div className="page-head">
            <div>
              <h1>{r.order?.orderNumber ?? "Return"}</h1>
              <p className="muted">
                {r.customer?.name ?? r.customer?.email ?? "Customer"} · {REASON[r.reason] ?? r.reason} ·{" "}
                <span className={`pill ${r.status === "REFUNDED" || r.status === "APPROVED" ? "ok" : r.status === "REJECTED" ? "cancelled" : "pending"}`}>{r.status}</span>
              </p>
            </div>
            <div className="status-actions">
              {r.status === "APPROVED" && (
                <button className="btn sm primary" disabled={busy} onClick={() => decide("refund")}>Refund {formatMoney(total, currency)}</button>
              )}
            </div>
          </div>
          {error && <p className="form-error" style={{ marginBottom: 10 }}>{error}</p>}

          {r.status === "REQUESTED" && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-head"><h2>Review this return</h2></div>
              <div className="card-body">
                <label className="full" style={{ display: "block" }}>
                  <span className="muted" style={{ fontSize: 13 }}>Message to the customer (optional) — they&rsquo;ll see this on their returns page</span>
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Approved — please post the item back to our returns address.  /  Sorry, we can't accept this because…"
                    style={{ width: "100%", marginTop: 6, padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 4, background: "var(--bg)", color: "var(--text)", font: "inherit" }}
                  />
                </label>
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button className="btn primary" disabled={busy} onClick={() => decide("approve")}>Approve &amp; restock</button>
                  <button className="btn danger" disabled={busy} onClick={() => decide("reject")}>Reject</button>
                </div>
              </div>
            </div>
          )}

          <div className="two-col">
            <div className="card">
              <div className="card-head"><h2>Items</h2></div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Item</th><th>SKU</th><th className="num">Qty</th><th className="num">Refund value</th></tr></thead>
                  <tbody>
                    {r.items.map((it) => (
                      <tr key={it.orderItemId}>
                        <td className="strong">{it.titleSnapshot}</td>
                        <td className="muted">{it.skuSnapshot}</td>
                        <td className="num">{it.quantity}</td>
                        <td className="num">{formatMoney(it.unitPriceMinor * it.quantity, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="card">
                <div className="card-head"><h2>Details</h2></div>
                <div className="card-body">
                  <dl style={{ margin: 0 }}>
                    <div className="kv"><dt>Reason</dt><dd>{REASON[r.reason] ?? r.reason}</dd></div>
                    <div className="kv"><dt className="strong">Refund value</dt><dd className="strong">{formatMoney(r.refundAmountMinor ?? total, currency)}</dd></div>
                    {r.status === "REFUNDED" && (
                      <div className="kv"><dt>Refund ref</dt><dd className="muted" style={{ fontSize: 12 }}>{r.refundId ?? "Offline (no online payment)"}</dd></div>
                    )}
                  </dl>
                  {r.comment && <p style={{ marginTop: 10 }}><span className="muted">Customer note:</span> {r.comment}</p>}
                  {r.staffNote && <p style={{ marginTop: 10 }}><span className="muted">Message to customer:</span> {r.staffNote}</p>}
                </div>
              </div>

              <div className="card">
                <div className="card-head"><h2>Photos ({r.photoUrls.length})</h2></div>
                <div className="card-body">
                  {r.photoUrls.length === 0 ? (
                    <p className="muted">No photos attached.</p>
                  ) : (
                    <div className="return-photos">
                      {r.photoUrls.map((p) => (
                        <a key={p} href={assetUrl(p)} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={assetUrl(p)} alt="Return photo" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}
