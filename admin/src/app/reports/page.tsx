"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/components/AdminAuthProvider";
import { getReports } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import type { Report } from "@/lib/types";

const RANGES: { label: string; days?: number }[] = [
  { label: "All time" },
  { label: "30 days", days: 30 },
  { label: "7 days", days: 7 },
];

export default function ReportsPage() {
  const { user, loading } = useAuth();
  const [range, setRange] = useState<number | undefined>(undefined);
  const [data, setData] = useState<Report | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      setData(await getReports(range));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [range]);

  useEffect(() => {
    if (loading || !user) return;
    void load();
  }, [user, loading, load]);

  const maxDaily = data ? Math.max(1, ...data.dailyRevenue.map((d) => d.revenueMinor)) : 1;

  return (
    <Shell title="Reports">
      <div className="filters">
        {RANGES.map((r) => (
          <button key={r.label} className={`chip ${range === r.days ? "active" : ""}`} onClick={() => setRange(r.days)}>{r.label}</button>
        ))}
      </div>

      {state === "loading" && <p className="muted">Loading…</p>}
      {state === "error" && <p className="muted">Couldn&rsquo;t load reports.</p>}
      {state === "ready" && data && (
        <>
          <div className="tiles">
            <div className="tile"><div className="tile-label">Revenue</div><div className="tile-value">{formatMoney(data.kpis.revenueMinor)}</div><div className="tile-sub">confirmed &amp; beyond</div></div>
            <div className="tile"><div className="tile-label">Orders</div><div className="tile-value">{data.kpis.orderCount}</div></div>
            <div className="tile"><div className="tile-label">Avg order value</div><div className="tile-value">{formatMoney(data.kpis.aovMinor)}</div></div>
            <div className="tile"><div className="tile-label">Customers</div><div className="tile-value">{data.kpis.customersCount}</div></div>
          </div>

          <div className="card">
            <div className="card-head"><h2>Revenue · last 14 days</h2></div>
            <div className="card-body">
              <div className="bars">
                {data.dailyRevenue.map((d) => (
                  <div key={d.date} className="bar-col" title={`${d.date}: ${formatMoney(d.revenueMinor)}`}>
                    <div className="bar" style={{ height: `${Math.round((d.revenueMinor / maxDaily) * 100)}%` }} />
                    <span className="bar-x">{d.date.slice(8)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="two-col">
            <div className="card">
              <div className="card-head"><h2>Sales by channel</h2></div>
              <div className="table-wrap">
                {data.byChannel.length === 0 ? <div className="empty">No sales yet.</div> : (
                  <table className="table">
                    <thead><tr><th>Channel</th><th className="num">Orders</th><th className="num">Revenue</th></tr></thead>
                    <tbody>
                      {data.byChannel.map((c) => (
                        <tr key={c.name}><td className="strong">{c.name}</td><td className="num">{c.orderCount}</td><td className="num">{formatMoney(c.revenueMinor)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-head"><h2>GST summary</h2></div>
              <div className="card-body">
                <dl style={{ margin: 0 }}>
                  <div className="kv"><dt>Taxable value</dt><dd>{formatMoney(data.gst.taxableMinor)}</dd></div>
                  <div className="kv"><dt>GST collected</dt><dd>{formatMoney(data.gst.gstMinor)}</dd></div>
                  <div className="kv"><dt>Shipping</dt><dd>{formatMoney(data.gst.shippingMinor)}</dd></div>
                  <div className="kv"><dt>Discounts</dt><dd>−{formatMoney(data.gst.discountMinor)}</dd></div>
                  <div className="kv"><dt className="strong">Gross sales</dt><dd className="strong">{formatMoney(data.gst.totalMinor)}</dd></div>
                </dl>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h2>Best sellers</h2></div>
            <div className="table-wrap">
              {data.bestSellers.length === 0 ? <div className="empty">No sales yet.</div> : (
                <table className="table">
                  <thead><tr><th>Product</th><th className="num">Units sold</th><th className="num">Revenue</th></tr></thead>
                  <tbody>
                    {data.bestSellers.map((b) => (
                      <tr key={b.title}><td className="strong">{b.title}</td><td className="num">{b.units}</td><td className="num">{formatMoney(b.revenueMinor)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h2>Low stock</h2></div>
            <div className="table-wrap">
              {data.lowStock.length === 0 ? <div className="empty">Everything is well stocked.</div> : (
                <table className="table">
                  <thead><tr><th>Product</th><th>Variant</th><th>SKU</th><th>Location</th><th className="num">Available</th></tr></thead>
                  <tbody>
                    {data.lowStock.map((i) => (
                      <tr key={i.sku + i.location}><td className="strong">{i.product}</td><td>{i.variantName}</td><td className="muted">{i.sku}</td><td>{i.location}</td><td className="num"><span className="pill low">{i.available}</span></td></tr>
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
