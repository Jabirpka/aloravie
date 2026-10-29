"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/components/AdminAuthProvider";
import {
  ApiRequestError,
  assetUrl,
  bookReturnPickup,
  decideReturn,
  getReturn,
  inspectReturn,
  receiveReturn,
  syncReturn,
} from "@/lib/api";
import { formatMoney } from "@/lib/money";
import type { ReturnRecord, ReturnStatus } from "@/lib/types";

const REASON: Record<string, string> = {
  WRONG_SIZE: "Wrong size / fit", DAMAGED: "Damaged or defective", NOT_AS_DESCRIBED: "Not as described",
  CHANGED_MIND: "Changed mind", OTHER: "Other",
};

const STATUS_LABEL: Record<ReturnStatus, string> = {
  REQUESTED: "Requested", APPROVED: "Approved", PICKUP_BOOKED: "Pickup booked",
  IN_TRANSIT: "On its way back", RECEIVED: "Received", REJECTED: "Rejected", REFUNDED: "Refunded",
};

function pillClass(s: ReturnStatus): string {
  if (s === "REFUNDED" || s === "RECEIVED" || s === "APPROVED") return "ok";
  if (s === "REJECTED") return "cancelled";
  return "pending";
}

export default function ReturnDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const [r, setR] = useState<ReturnRecord | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [inspectNote, setInspectNote] = useState("");
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

  // Run an action, show its error if any, and refresh the record.
  async function run(fn: () => Promise<ReturnRecord>) {
    setBusy(true);
    setError(null);
    try {
      setR(await fn());
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
                <span className={`pill ${pillClass(r.status)}`}>{STATUS_LABEL[r.status]}</span>
              </p>
            </div>
          </div>
          {error && <p className="form-error" style={{ marginBottom: 10 }}>{error}</p>}

          {/* Step 1 — review the request */}
          {r.status === "REQUESTED" && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-head"><h2>1 · Review this return</h2></div>
              <div className="card-body">
                <label className="full" style={{ display: "block" }}>
                  <span className="muted" style={{ fontSize: 13 }}>Message to the customer (optional) — they&rsquo;ll see this on their returns page</span>
                  <textarea
                    rows={3} value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Approved — a courier will collect the item.  /  Sorry, we can't accept this because…"
                    style={{ width: "100%", marginTop: 6, padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 4, background: "var(--bg)", color: "var(--text)", font: "inherit" }}
                  />
                </label>
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button className="btn primary" disabled={busy} onClick={() => run(() => decideReturn(r.id, "approve", note.trim() || undefined))}>Approve</button>
                  <button className="btn danger" disabled={busy} onClick={() => run(() => decideReturn(r.id, "reject", note.trim() || undefined))}>Reject</button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — arrange the pickup */}
          {r.status === "APPROVED" && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-head"><h2>2 · Get the item back</h2></div>
              <div className="card-body">
                <p className="muted" style={{ marginTop: 0 }}>Book a courier to collect it from the customer, or mark it received if they&rsquo;re shipping it back themselves.</p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn primary" disabled={busy} onClick={() => run(() => bookReturnPickup(r.id))}>Book return pickup</button>
                  <button className="btn" disabled={busy} onClick={() => run(() => receiveReturn(r.id))}>Mark received</button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2b — in transit */}
          {(r.status === "PICKUP_BOOKED" || r.status === "IN_TRANSIT") && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-head"><h2>2 · Return in transit</h2></div>
              <div className="card-body">
                {r.pickupAwb && <p style={{ marginTop: 0 }}><span className="muted">Pickup AWB:</span> <span className="strong">{r.pickupAwb}</span>{r.pickupCourier ? ` · ${r.pickupCourier}` : ""}</p>}
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn" disabled={busy} onClick={() => run(() => syncReturn(r.id))}>Refresh tracking</button>
                  <button className="btn primary" disabled={busy} onClick={() => run(() => receiveReturn(r.id))}>Mark received</button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — physical check */}
          {r.status === "RECEIVED" && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-head"><h2>3 · Physical check</h2></div>
              <div className="card-body">
                <p className="muted" style={{ marginTop: 0 }}>Inspect the item. Passing it refunds the customer and returns the stock; failing it rejects the return (no refund, no restock).</p>
                <label className="full" style={{ display: "block" }}>
                  <span className="muted" style={{ fontSize: 13 }}>Inspection note (optional)</span>
                  <textarea
                    rows={2} value={inspectNote} onChange={(e) => setInspectNote(e.target.value)}
                    placeholder="e.g. Tags intact, unworn — OK.  /  Worn with a stain — not resellable."
                    style={{ width: "100%", marginTop: 6, padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 4, background: "var(--bg)", color: "var(--text)", font: "inherit" }}
                  />
                </label>
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button className="btn primary" disabled={busy} onClick={() => run(() => inspectReturn(r.id, true, inspectNote.trim() || undefined))}>Pass — refund {formatMoney(total, currency)} &amp; restock</button>
                  <button className="btn danger" disabled={busy} onClick={() => run(() => inspectReturn(r.id, false, inspectNote.trim() || undefined))}>Fail — reject</button>
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

              {r.returnEvents.length > 0 && (
                <>
                  <div className="card-head" style={{ borderTop: "1px solid var(--line)" }}><h2>Return tracking</h2></div>
                  <div className="card-body">
                    <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                      {r.returnEvents.map((e) => (
                        <li key={e.id}>
                          <span className="strong">{e.status}</span>
                          {e.location ? ` · ${e.location}` : ""}{" "}
                          <span className="muted" style={{ fontSize: 12 }}>{new Date(e.occurredAt).toLocaleString("en-IN")}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </>
              )}
            </div>

            <div>
              <div className="card">
                <div className="card-head"><h2>Details</h2></div>
                <div className="card-body">
                  <dl style={{ margin: 0 }}>
                    <div className="kv"><dt>Reason</dt><dd>{REASON[r.reason] ?? r.reason}</dd></div>
                    <div className="kv"><dt className="strong">Refund value</dt><dd className="strong">{formatMoney(r.refundAmountMinor ?? total, currency)}</dd></div>
                    {r.pickupAwb && <div className="kv"><dt>Pickup AWB</dt><dd>{r.pickupAwb}</dd></div>}
                    {r.receivedAt && <div className="kv"><dt>Received</dt><dd>{new Date(r.receivedAt).toLocaleDateString("en-IN")}</dd></div>}
                    {r.inspectionPassed != null && (
                      <div className="kv"><dt>Inspection</dt><dd>{r.inspectionPassed ? "Passed" : "Failed"}</dd></div>
                    )}
                    {r.status === "REFUNDED" && (
                      <div className="kv"><dt>Refund ref</dt><dd className="muted" style={{ fontSize: 12 }}>{r.refundId ?? "Offline (no online payment)"}</dd></div>
                    )}
                  </dl>
                  {r.comment && <p style={{ marginTop: 10 }}><span className="muted">Customer note:</span> {r.comment}</p>}
                  {r.staffNote && <p style={{ marginTop: 10 }}><span className="muted">Message to customer:</span> {r.staffNote}</p>}
                  {r.inspectionNote && <p style={{ marginTop: 10 }}><span className="muted">Inspection note:</span> {r.inspectionNote}</p>}
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
