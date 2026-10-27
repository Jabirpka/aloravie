"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/components/AdminAuthProvider";
import { listNotifications } from "@/lib/api";
import type { NotificationLogRow } from "@/lib/types";

const EVENT_LABEL: Record<string, string> = {
  ORDER_CONFIRMED: "Order confirmed",
  ORDER_SHIPPED: "Order shipped",
  ORDER_DELIVERED: "Order delivered",
  SUPPORT_REPLY: "Support reply",
};

export default function NotificationsPage() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<NotificationLogRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    listNotifications()
      .then((r) => {
        if (!active) return;
        setRows(r);
        setState("ready");
      })
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, [user, loading]);

  return (
    <Shell title="Notifications">
      <p className="muted" style={{ marginBottom: 16, maxWidth: "70ch" }}>
        Every email, SMS and WhatsApp the platform sent customers on order and support events.
        Running in simulation (logged, not sent) unless live provider keys are set.
      </p>
      <div className="card">
        <div className="table-wrap">
          {state === "loading" && <div className="empty">Loading…</div>}
          {state === "error" && <div className="empty">Couldn&rsquo;t load notifications.</div>}
          {state === "ready" &&
            (rows.length === 0 ? (
              <div className="empty">No notifications yet.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>When</th><th>Channel</th><th>Event</th><th>Recipient</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {rows.map((n) => (
                    <tr key={n.id}>
                      <td className="muted">{new Date(n.createdAt).toLocaleString("en-IN")}</td>
                      <td>{n.channel}</td>
                      <td className="strong">{EVENT_LABEL[n.event] ?? n.event}</td>
                      <td className="muted">{n.recipient}</td>
                      <td><span className={`pill ${n.status === "SENT" ? "ok" : n.status === "FAILED" ? "cancelled" : ""}`}>{n.status}</span></td>
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
