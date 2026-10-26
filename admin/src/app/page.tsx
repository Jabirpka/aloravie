"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/components/AdminAuthProvider";
import { getSummary } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import type { Summary } from "@/lib/types";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    getSummary()
      .then((s) => {
        if (!active) return;
        setSummary(s);
        setState("ready");
      })
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, [user, loading]);

  return (
    <Shell title="Dashboard">
      {state === "loading" && <p className="muted">Loading…</p>}
      {state === "error" && <p className="muted">Couldn&rsquo;t load the dashboard. Is the API running and seeded?</p>}
      {state === "ready" && summary && (
        <>
          <div className="tiles">
            <div className="tile">
              <div className="tile-label">Revenue</div>
              <div className="tile-value">{formatMoney(summary.revenueMinor)}</div>
              <div className="tile-sub">confirmed &amp; beyond</div>
            </div>
            <div className="tile">
              <div className="tile-label">Orders</div>
              <div className="tile-value">{summary.totalOrders}</div>
              <div className="tile-sub">{summary.statusCounts.PENDING ?? 0} awaiting payment</div>
            </div>
            <div className="tile">
              <div className="tile-label">Customers</div>
              <div className="tile-value">{summary.customersCount}</div>
            </div>
            <div className="tile">
              <div className="tile-label">Products</div>
              <div className="tile-value">{summary.productsCount}</div>
              <div className="tile-sub">{summary.lowStock.length} low on stock</div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h2>Recent orders</h2><Link href="/orders" className="link-btn">All orders →</Link></div>
            <div className="table-wrap">
              {summary.recentOrders.length === 0 ? (
                <div className="empty">No orders yet.</div>
              ) : (
                <table className="table">
                  <thead>
                    <tr><th>Order</th><th>Customer</th><th>Status</th><th>Payment</th><th className="num">Total</th></tr>
                  </thead>
                  <tbody>
                    {summary.recentOrders.map((o) => (
                      <tr key={o.id}>
                        <td className="strong"><Link href={`/orders/${o.orderNumber}`}>{o.orderNumber}</Link></td>
                        <td>{o.customer?.name ?? o.customer?.email ?? "—"}</td>
                        <td><span className={`pill ${o.status.toLowerCase()}`}>{o.status}</span></td>
                        <td><span className={`pill ${(o.payment?.status ?? "").toLowerCase()}`}>{o.payment?.status ?? "—"}</span></td>
                        <td className="num">{formatMoney(o.totalMinor, o.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h2>Low stock</h2><Link href="/inventory" className="link-btn">Inventory →</Link></div>
            <div className="table-wrap">
              {summary.lowStock.length === 0 ? (
                <div className="empty">Everything is well stocked.</div>
              ) : (
                <table className="table">
                  <thead>
                    <tr><th>Product</th><th>Variant</th><th>SKU</th><th>Location</th><th className="num">Available</th></tr>
                  </thead>
                  <tbody>
                    {summary.lowStock.map((i) => (
                      <tr key={i.variantId}>
                        <td className="strong">{i.product}</td>
                        <td>{i.variantName}</td>
                        <td className="muted">{i.sku}</td>
                        <td>{i.location}</td>
                        <td className="num"><span className="pill low">{i.available}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}
