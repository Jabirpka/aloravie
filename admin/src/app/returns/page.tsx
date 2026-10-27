"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/components/AdminAuthProvider";
import { listReturns } from "@/lib/api";
import type { ReturnRecord } from "@/lib/types";

const STATUSES: (ReturnRecord["status"] | "ALL")[] = ["REQUESTED", "APPROVED", "REFUNDED", "REJECTED", "ALL"];
const REASON: Record<string, string> = {
  WRONG_SIZE: "Wrong size", DAMAGED: "Damaged", NOT_AS_DESCRIBED: "Not as described",
  CHANGED_MIND: "Changed mind", OTHER: "Other",
};

export default function ReturnsPage() {
  const { user, loading } = useAuth();
  const [filter, setFilter] = useState<ReturnRecord["status"] | "ALL">("REQUESTED");
  const [rows, setRows] = useState<ReturnRecord[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      setRows(await listReturns(filter === "ALL" ? undefined : filter));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [filter]);

  useEffect(() => {
    if (loading || !user) return;
    void load();
  }, [user, loading, load]);

  return (
    <Shell title="Returns">
      <div className="filters">
        {STATUSES.map((s) => (
          <button key={s} className={`chip ${filter === s ? "active" : ""}`} onClick={() => setFilter(s)}>
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      <div className="card">
        <div className="table-wrap">
          {state === "loading" && <div className="empty">Loading…</div>}
          {state === "error" && <div className="empty">Couldn&rsquo;t load returns.</div>}
          {state === "ready" &&
            (rows.length === 0 ? (
              <div className="empty">No returns in this view.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Order</th><th>Customer</th><th>Reason</th><th className="num">Items</th><th>Photos</th><th>Status</th><th>Requested</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="strong"><Link href={`/returns/${r.id}`}>{r.order?.orderNumber ?? "—"}</Link></td>
                      <td>{r.customer?.name ?? r.customer?.email ?? "—"}</td>
                      <td>{REASON[r.reason] ?? r.reason}</td>
                      <td className="num">{r.items.reduce((n, i) => n + i.quantity, 0)}</td>
                      <td>{r.photoUrls.length || "—"}</td>
                      <td><span className={`pill ${r.status === "REFUNDED" || r.status === "APPROVED" ? "ok" : r.status === "REJECTED" ? "cancelled" : "pending"}`}>{r.status}</span></td>
                      <td className="muted">{new Date(r.createdAt).toLocaleDateString("en-IN")}</td>
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
