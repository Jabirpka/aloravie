// Printable HTML documents: GST invoice, delivery note, shipping label.
// Rendered server-side and returned as text/html; staff open and print (→ PDF).
import { env } from "../../env.js";
import { formatMoney } from "../../lib/money.js";
import { gstRateForUnitPrice } from "../../lib/tax.js";

export interface DocAddress {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
}

export interface DocOrder {
  orderNumber: string;
  placedAt: Date | string;
  currency: string;
  subtotalMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  email: string | null;
  phone: string | null;
  shippingAddress: DocAddress | null;
  items: { titleSnapshot: string; skuSnapshot: string; unitPriceMinor: number; quantity: number; totalMinor: number }[];
  payment: { provider: string; status: string } | null;
}

export interface DocShipment {
  courierName: string;
  awb: string | null;
  status: string;
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function addressBlock(a: DocAddress | null): string {
  if (!a) return `<p class="muted">No address on file.</p>`;
  return `
    <strong>${esc(a.name)}</strong><br>
    ${esc(a.line1)}${a.line2 ? `, ${esc(a.line2)}` : ""}<br>
    ${esc(a.city)}, ${esc(a.state)} ${esc(a.pincode)}<br>
    ${esc(a.country ?? "India")}<br>
    <span class="muted">${esc(a.phone)}</span>`;
}

function sellerBlock(): string {
  return `
    <strong>${esc(env.SELLER_NAME)}</strong><br>
    ${esc(env.SELLER_ADDRESS)}<br>
    ${env.SELLER_GSTIN ? `GSTIN: ${esc(env.SELLER_GSTIN)}<br>` : `<span class="muted">GSTIN: not set</span><br>`}
    ${esc(env.SELLER_EMAIL)}${env.SELLER_PHONE ? ` · ${esc(env.SELLER_PHONE)}` : ""}`;
}

// Shared page chrome + print styles. `size` is the @page size.
function page(title: string, body: string, size = "A4"): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  @page { size: ${size}; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Jost", ui-sans-serif, system-ui, "Segoe UI", sans-serif; color: #3A2620; font-size: 13px; line-height: 1.5; margin: 0; padding: 20px; }
  .doc { max-width: 760px; margin: 0 auto; }
  .brand { font-size: 26px; font-weight: 600; color: #C8714F; letter-spacing: -.01em; }
  .muted { color: #8A5A44; }
  .row { display: flex; justify-content: space-between; gap: 24px; }
  .mt { margin-top: 20px; } .mt-lg { margin-top: 32px; }
  h1 { font-size: 20px; margin: 0 0 2px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #8A5A44; border-bottom: 1.5px solid #C8714F; padding: 8px 6px; }
  td { padding: 8px 6px; border-bottom: 1px solid #E4D6C4; }
  .num { text-align: right; }
  .totals { width: 280px; margin-left: auto; margin-top: 12px; }
  .totals td { border: 0; padding: 4px 6px; }
  .totals .grand td { border-top: 1.5px solid #C8714F; font-weight: 600; font-size: 15px; padding-top: 8px; }
  .box { border: 1px solid #E4D6C4; border-radius: 6px; padding: 14px; }
  .foot { margin-top: 34px; font-size: 11px; color: #8A5A44; border-top: 1px solid #E4D6C4; padding-top: 10px; }
  .print-btn { margin: 0 0 16px; }
  @media print { .print-btn { display: none; } body { padding: 0; } }
  .btn { font: inherit; background: #C8714F; color: #FFF8F0; border: 0; padding: 9px 18px; border-radius: 6px; cursor: pointer; }
</style></head>
<body>
  <div class="print-btn"><button class="btn" onclick="window.print()">Print / Save as PDF</button></div>
  <div class="doc">${body}</div>
</body></html>`;
}

export function renderInvoice(order: DocOrder): string {
  const buyerState = order.shippingAddress?.state ?? "";
  const intraState = env.SELLER_STATE.trim().toLowerCase() === buyerState.trim().toLowerCase();

  const rows = order.items
    .map((it) => {
      const taxable = it.totalMinor;
      const rate = gstRateForUnitPrice(it.unitPriceMinor);
      const gst = Math.round(taxable * rate);
      return `<tr>
        <td>${esc(it.titleSnapshot)}<br><span class="muted">${esc(it.skuSnapshot)}</span></td>
        <td class="num">${it.quantity}</td>
        <td class="num">${formatMoney(it.unitPriceMinor, order.currency)}</td>
        <td class="num">${formatMoney(taxable, order.currency)}</td>
        <td class="num">${(rate * 100).toFixed(0)}%</td>
        <td class="num">${formatMoney(gst, order.currency)}</td>
      </tr>`;
    })
    .join("");

  const gstRows = intraState
    ? `<tr><td>CGST</td><td class="num">${formatMoney(Math.round(order.taxMinor / 2), order.currency)}</td></tr>
       <tr><td>SGST</td><td class="num">${formatMoney(order.taxMinor - Math.round(order.taxMinor / 2), order.currency)}</td></tr>`
    : `<tr><td>IGST</td><td class="num">${formatMoney(order.taxMinor, order.currency)}</td></tr>`;

  const body = `
    <div class="row">
      <div><div class="brand">aloravie</div><div class="muted">Tax Invoice</div></div>
      <div style="text-align:right">
        <h1>${esc(order.orderNumber)}</h1>
        <div class="muted">${fmtDate(order.placedAt)}</div>
        <div class="muted">Payment: ${esc(order.payment?.status ?? "—")}</div>
      </div>
    </div>
    <div class="row mt-lg">
      <div style="flex:1"><div class="muted">Sold by</div>${sellerBlock()}</div>
      <div style="flex:1"><div class="muted">Billed / shipped to</div>${addressBlock(order.shippingAddress)}</div>
    </div>
    <table>
      <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Taxable</th><th class="num">GST</th><th class="num">GST amt</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <table class="totals">
      <tr><td>Subtotal</td><td class="num">${formatMoney(order.subtotalMinor, order.currency)}</td></tr>
      ${gstRows}
      <tr><td>Shipping</td><td class="num">${order.shippingMinor === 0 ? "Free" : formatMoney(order.shippingMinor, order.currency)}</td></tr>
      <tr class="grand"><td>Total</td><td class="num">${formatMoney(order.totalMinor, order.currency)}</td></tr>
    </table>
    <div class="foot">
      This is a computer-generated invoice. ${env.SELLER_GSTIN ? "" : "Add your GSTIN in settings before issuing to customers. "}
      Place of supply: ${esc(buyerState || "—")} · ${intraState ? "Intra-state (CGST + SGST)" : "Inter-state (IGST)"}.
    </div>`;
  return page(`Invoice ${order.orderNumber}`, body);
}

export function renderDeliveryNote(order: DocOrder): string {
  const rows = order.items
    .map(
      (it) => `<tr><td>${esc(it.titleSnapshot)}</td><td class="muted">${esc(it.skuSnapshot)}</td><td class="num">${it.quantity}</td></tr>`,
    )
    .join("");
  const body = `
    <div class="row">
      <div><div class="brand">aloravie</div><div class="muted">Delivery Note</div></div>
      <div style="text-align:right"><h1>${esc(order.orderNumber)}</h1><div class="muted">${fmtDate(order.placedAt)}</div></div>
    </div>
    <div class="row mt-lg">
      <div style="flex:1"><div class="muted">From</div>${sellerBlock()}</div>
      <div style="flex:1"><div class="muted">Deliver to</div>${addressBlock(order.shippingAddress)}</div>
    </div>
    <table>
      <thead><tr><th>Item</th><th>SKU</th><th class="num">Qty</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="foot">Packed with care. No prices are shown on this delivery note. Thank you for shopping with Aloravie — dressed up in first light.</div>`;
  return page(`Delivery note ${order.orderNumber}`, body);
}

export function renderLabel(order: DocOrder, shipment: DocShipment | null): string {
  const itemCount = order.items.reduce((n, it) => n + it.quantity, 0);
  const body = `
    <div class="box">
      <div class="row">
        <div class="brand">aloravie</div>
        <div style="text-align:right"><strong>${esc(order.orderNumber)}</strong><br><span class="muted">${itemCount} item${itemCount === 1 ? "" : "s"}</span></div>
      </div>
      <div class="mt-lg" style="font-size:16px; line-height:1.6">
        <div class="muted" style="font-size:11px; text-transform:uppercase; letter-spacing:.06em">Ship to</div>
        ${addressBlock(order.shippingAddress)}
      </div>
      <div class="mt" style="border-top:1px dashed #C8714F; padding-top:12px">
        <div class="muted" style="font-size:11px; text-transform:uppercase; letter-spacing:.06em">Courier</div>
        <strong>${esc(shipment?.courierName ?? "Not booked")}</strong>
        ${shipment?.awb ? `<div style="font-size:22px; letter-spacing:2px; margin-top:6px">${esc(shipment.awb)}</div>` : ""}
      </div>
      <div class="mt" style="font-size:11px">
        <div class="muted" style="font-size:11px; text-transform:uppercase; letter-spacing:.06em">From</div>
        ${sellerBlock()}
      </div>
    </div>`;
  // A6 suits a thermal/label printer; staff can still scale on A4.
  return page(`Label ${order.orderNumber}`, body, "A6");
}
