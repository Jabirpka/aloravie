"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/components/AdminAuthProvider";
import { listSupport } from "@/lib/api";
import type { SupportConversationRow } from "@/lib/types";

export default function SupportPage() {
  const { user, loading } = useAuth();
  const [filter, setFilter] = useState<"ALL" | "OPEN" | "CLOSED">("OPEN");
  const [rows, setRows] = useState<SupportConversationRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      setRows(await listSupport(filter === "ALL" ? undefined : filter));
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
    <Shell title="Support">
      <div className="filters">
        {(["OPEN", "CLOSED", "ALL"] as const).map((s) => (
          <button key={s} className={`chip ${filter === s ? "active" : ""}`} onClick={() => setFilter(s)}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          {state === "loading" && <div className="empty">Loading…</div>}
          {state === "error" && <div className="empty">Couldn&rsquo;t load conversations.</div>}
          {state === "ready" &&
            (rows.length === 0 ? (
              <div className="empty">No conversations in this view.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Subject</th><th>Customer</th><th className="num">Messages</th><th>Status</th><th>Last activity</th></tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <td className="strong"><Link href={`/support/${c.id}`}>{c.subject}</Link></td>
                      <td>{c.customer?.name ?? c.customer?.email ?? "—"}</td>
                      <td className="num">{c._count.messages}</td>
                      <td><span className={`pill ${c.status === "OPEN" ? "pending" : "cancelled"}`}>{c.status}</span></td>
                      <td className="muted">{new Date(c.lastMessageAt).toLocaleString("en-IN")}</td>
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
