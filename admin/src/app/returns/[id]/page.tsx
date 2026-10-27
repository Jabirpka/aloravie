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
      setR(await decideReturn(params.id, action));
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
              {r.status === "REQUESTED" && (
                <>
                  <button className="btn sm primary" disabled={busy} onClick={() => decide("approve")}>Approve &amp; restock</button>
                  <button className="btn sm danger" disabled={busy} onClick={() => decide("reject")}>Reject</button>
                </>
              )}
              {r.status === "APPROVED" && (
                <button className="btn sm primary" disabled={busy} onClick={() => decide("refund")}>Refund {formatMoney(total, currency)}</button>
              )}
            </div>
          </div>
          {error && <p className="form-error" style={{ marginBottom: 10 }}>{error}</p>}

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
                  </dl>
                  {r.comment && <p style={{ marginTop: 10 }}><span className="muted">Customer note:</span> {r.comment}</p>}
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
