"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { formatMoney } from "@/lib/money";
import type { ReturnRequest } from "@/lib/types";
import { listReturns } from "@/lib/client";

const REASON_LABEL: Record<string, string> = {
  WRONG_SIZE: "Wrong size / fit",
  DAMAGED: "Damaged or defective",
  NOT_AS_DESCRIBED: "Not as described",
  CHANGED_MIND: "Changed my mind",
  OTHER: "Other",
};
const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REFUNDED: "Refunded",
};

export default function ReturnsPage() {
  const { customer, loading } = useAuth();
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (loading || !customer) return;
    listReturns()
      .then((r) => {
        setReturns(r);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [customer, loading]);

  if (loading || state === "loading") return <section className="container section"><p className="muted">Loading…</p></section>;
  if (!customer) {
    return (
      <section className="container section narrow">
        <h1 className="checkout-h">Sign in</h1>
        <Link href="/account?next=/account/returns" className="btn primary">Sign in</Link>
      </section>
    );
  }

  return (
    <section className="container section narrow">
      <p className="eyebrow">Your account</p>
      <h1 className="checkout-h">Returns</h1>
      {returns.length === 0 ? (
        <p className="muted">No return requests yet.</p>
      ) : (
        <div className="returns-list">
          {returns.map((r) => (
            <div key={r.id} className="return-row">
              <div className="return-row-head">
                <span className="strong">{r.order?.orderNumber ?? "Order"}</span>
                <span className={`status-pill status-${r.status.toLowerCase()}`}>{STATUS_LABEL[r.status]}</span>
              </div>
              <div className="muted">{REASON_LABEL[r.reason]} · {r.items.reduce((n, i) => n + i.quantity, 0)} item(s) · {new Date(r.createdAt).toLocaleDateString("en-IN")}</div>
              <div className="return-row-items">{r.items.map((i) => `${i.titleSnapshot} ×${i.quantity}`).join(", ")}</div>
              {r.status === "REFUNDED" && r.refundAmountMinor != null && (
                <div className="strong">Refunded {formatMoney(r.refundAmountMinor, r.order?.currency ?? "INR")}</div>
              )}
              {r.staffNote && (
                <div className="return-note" style={{ marginTop: 6 }}>
                  <span className="muted" style={{ fontSize: 12 }}>Note from the team:</span> {r.staffNote}
                </div>
              )}
              {r.photoUrls.length > 0 && <div className="muted" style={{ fontSize: 12 }}>{r.photoUrls.length} photo(s) attached</div>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
