"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/components/AdminAuthProvider";
import { listOrders } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import type { OrderRow, OrderStatus } from "@/lib/types";

const STATUSES: (OrderStatus | "ALL")[] = [
  "ALL",
  "PENDING",
  "CONFIRMED",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
];

export default function OrdersPage() {
  const { user, loading } = useAuth();
  const [filter, setFilter] = useState<OrderStatus | "ALL">("ALL");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    setState("loading");
    listOrders(filter === "ALL" ? undefined : filter)
      .then((o) => {
        if (!active) return;
        setOrders(o);
        setState("ready");
      })
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, [user, loading, filter]);

  return (
    <Shell title="Orders">
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
          {state === "error" && <div className="empty">Couldn&rsquo;t load orders.</div>}
          {state === "ready" &&
            (orders.length === 0 ? (
              <div className="empty">No orders in this view.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Order</th><th>Date</th><th>Customer</th><th>Channel</th>
                    <th>Items</th><th>Status</th><th>Payment</th><th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="strong"><Link href={`/orders/${o.orderNumber}`}>{o.orderNumber}</Link></td>
                      <td className="muted">{new Date(o.placedAt).toLocaleDateString("en-IN")}</td>
                      <td>{o.customer?.name ?? o.customer?.email ?? "—"}</td>
                      <td>{o.channel?.name ?? "—"}</td>
                      <td className="num">{o._count.items}</td>
                      <td><span className={`pill ${o.status.toLowerCase()}`}>{o.status}</span></td>
                      <td><span className={`pill ${(o.payment?.status ?? "").toLowerCase()}`}>{o.payment?.status ?? "—"}</span></td>
                      <td className="num">{formatMoney(o.totalMinor, o.currency)}</td>
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
