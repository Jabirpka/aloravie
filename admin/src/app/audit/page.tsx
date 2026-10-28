"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/components/AdminAuthProvider";
import { listAudit } from "@/lib/api";
import type { AuditEntry } from "@/lib/types";

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AuditPage() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      setRows(await listAudit());
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    void load();
  }, [user, loading, load]);

  return (
    <Shell title="Audit log">
      <p className="muted" style={{ marginBottom: 12 }}>
        Who did what across the back office. The 150 most recent changes.
      </p>
      <div className="card">
        <div className="table-wrap">
          {state === "loading" && <div className="empty">Loading…</div>}
          {state === "error" && <div className="empty">Couldn&rsquo;t load the audit log.</div>}
          {state === "ready" &&
            (rows.length === 0 ? (
              <div className="empty">No activity recorded yet.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>When</th><th>Who</th><th>Action</th><th>Request</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: "nowrap" }} className="muted">{when(r.createdAt)}</td>
                      <td>{r.actorEmail}</td>
                      <td className="strong">{r.summary}</td>
                      <td className="muted" style={{ fontSize: 12 }}>
                        <span className="pill">{r.method}</span> {r.path}
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
