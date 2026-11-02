// Printable business report: the same data as the Reports page and the CSV
// export, laid out as a styled A4 document. Served as text/html; staff open it
// and use "Print / Save as PDF". Reuses the invoice/document print chrome.
import { env } from "../../env.js";
import { formatMoney } from "../../lib/money.js";
import { page, esc } from "../fulfilment/documents.js";
import type { getReports } from "./reports.service.js";

type Report = Awaited<ReturnType<typeof getReports>>;

const inr = (minor: number) => formatMoney(minor, "INR");

function fmtDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function renderReportDoc(r: Report): string {
  const generatedAt = new Date().toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const rangeLabel = r.days ? `Last ${r.days} days` : "All time";

  const kpiCards = `
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Revenue</div><div class="kpi-value">${inr(r.kpis.revenueMinor)}</div></div>
      <div class="kpi"><div class="kpi-label">Orders</div><div class="kpi-value">${r.kpis.orderCount}</div></div>
      <div class="kpi"><div class="kpi-label">Avg order value</div><div class="kpi-value">${inr(r.kpis.aovMinor)}</div></div>
      <div class="kpi"><div class="kpi-label">Customers</div><div class="kpi-value">${r.kpis.customersCount}</div></div>
    </div>`;

  const gstTable = `
    <table class="totals" style="width:320px">
      <tr><td>Taxable value</td><td class="num">${inr(r.gst.taxableMinor)}</td></tr>
      <tr><td>GST collected</td><td class="num">${inr(r.gst.gstMinor)}</td></tr>
      <tr><td>Shipping</td><td class="num">${inr(r.gst.shippingMinor)}</td></tr>
      ${r.gst.discountMinor > 0 ? `<tr><td>Discounts</td><td class="num">−${inr(r.gst.discountMinor)}</td></tr>` : ""}
      <tr class="grand"><td>Total revenue</td><td class="num">${inr(r.gst.totalMinor)}</td></tr>
    </table>`;

  const channelRows = r.byChannel.length
    ? r.byChannel
        .map((c) => `<tr><td>${esc(c.name)}</td><td class="num">${c.orderCount}</td><td class="num">${inr(c.revenueMinor)}</td></tr>`)
        .join("")
    : `<tr><td colspan="3" class="muted">No sales in this period.</td></tr>`;

  const bestRows = r.bestSellers.length
    ? r.bestSellers
        .map((b) => `<tr><td>${esc(b.title)}</td><td class="num">${b.units}</td><td class="num">${inr(b.revenueMinor)}</td></tr>`)
        .join("")
    : `<tr><td colspan="3" class="muted">No sales in this period.</td></tr>`;

  const maxDaily = Math.max(1, ...r.dailyRevenue.map((d) => d.revenueMinor));
  const bars = r.dailyRevenue
    .map((d) => {
      const h = Math.round((d.revenueMinor / maxDaily) * 100);
      return `<div class="bar-col"><div class="bar" style="height:${h}%" title="${inr(d.revenueMinor)}"></div><div class="bar-day">${fmtDay(d.date)}</div></div>`;
    })
    .join("");

  const lowRows = r.lowStock.length
    ? r.lowStock
        .map(
          (l) =>
            `<tr><td>${esc(l.product)}</td><td class="muted">${esc(l.variantName)}</td><td class="muted">${esc(l.sku)}</td><td class="num">${l.available}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="4" class="muted">Everything is well stocked.</td></tr>`;

  const body = `
    <div class="row">
      <div><div class="brand">aloravie</div><div class="muted">Business Report</div></div>
      <div style="text-align:right">
        <h1>${esc(rangeLabel)}</h1>
        <div class="muted">Generated ${esc(generatedAt)}</div>
      </div>
    </div>

    <div class="mt-lg">${kpiCards}</div>

    <h2>GST summary</h2>
    <div class="muted" style="font-size:11px">Prices are GST-inclusive; the taxable value is the revenue with GST removed.</div>
    ${gstTable}

    <h2 class="mt-lg">Daily revenue — last 14 days</h2>
    <div class="chart">${bars}</div>

    <div class="row mt-lg" style="align-items:flex-start; gap:28px">
      <div style="flex:1">
        <h2>Sales by channel</h2>
        <table>
          <thead><tr><th>Channel</th><th class="num">Orders</th><th class="num">Revenue</th></tr></thead>
          <tbody>${channelRows}</tbody>
        </table>
      </div>
      <div style="flex:1">
        <h2>Best sellers</h2>
        <table>
          <thead><tr><th>Product</th><th class="num">Units</th><th class="num">Revenue</th></tr></thead>
          <tbody>${bestRows}</tbody>
        </table>
      </div>
    </div>

    <h2 class="mt-lg">Low stock (≤ 5 available)</h2>
    <table>
      <thead><tr><th>Product</th><th>Variant</th><th>SKU</th><th class="num">Available</th></tr></thead>
      <tbody>${lowRows}</tbody>
    </table>

    <div class="foot">
      ${esc(env.SELLER_NAME)} · computer-generated report. Figures cover ${esc(rangeLabel.toLowerCase())}; revenue counts confirmed orders and beyond.
    </div>`;

  // Extra styles layered on top of the shared print chrome.
  const extra = `<style>
    h2 { font-size: 15px; margin: 22px 0 0; font-weight: 600; color: #3A2620; }
    .kpis { display: flex; gap: 12px; }
    .kpi { flex: 1; border: 1px solid #E4D6C4; border-radius: 8px; padding: 12px 14px; }
    .kpi-label { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #8A5A44; }
    .kpi-value { font-size: 20px; font-weight: 600; margin-top: 4px; }
    .chart { display: flex; align-items: flex-end; gap: 6px; height: 130px; margin-top: 14px; padding-bottom: 2px; }
    .chart .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 4px; }
    .chart .bar { width: 100%; max-width: 26px; min-height: 2px; background: #C8714F; border-radius: 3px 3px 0 0; }
    .chart .bar-day { font-size: 9px; color: #8A5A44; white-space: nowrap; }
    @media print { .chart .bar { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>`;

  return page("Aloravie report", extra + body);
}
