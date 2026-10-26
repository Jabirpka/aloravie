"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/components/AdminAuthProvider";
import {
  ApiRequestError,
  createShipment,
  fetchDocumentHtml,
  getOrder,
  syncTracking,
  updateOrderStatus,
  type DocumentKind,
} from "@/lib/api";
import { formatMoney } from "@/lib/money";
import type { OrderDetail, OrderStatus } from "@/lib/types";

// Next legal status moves, mirroring the backend transition map.
const NEXT: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

export default function OrderDetailPage() {
  const params = useParams<{ slug: string }>();
  const orderNumber = params.slug;
  const { user, loading } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    getOrder(orderNumber)
      .then((o) => {
        if (!active) return;
        setOrder(o);
        setState("ready");
      })
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, [orderNumber, user, loading]);

  async function changeStatus(next: OrderStatus) {
    if (!order) return;
    setError(null);
    setBusy(true);
    try {
      setOrder(await updateOrderStatus(order.id, next));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't update the order.");
    } finally {
      setBusy(false);
    }
  }

  async function bookShipment() {
    if (!order) return;
    setError(null);
    setBusy(true);
    try {
      const shipment = await createShipment(order.id);
      setOrder({ ...order, shipment, status: "SHIPPED" });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't book the shipment.");
    } finally {
      setBusy(false);
    }
  }

  async function sync() {
    if (!order?.shipment) return;
    setError(null);
    setBusy(true);
    try {
      const shipment = await syncTracking(order.shipment.id);
      setOrder({ ...order, shipment, status: shipment.status === "DELIVERED" ? "DELIVERED" : order.status });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't sync tracking.");
    } finally {
      setBusy(false);
    }
  }

  async function openDoc(kind: DocumentKind) {
    if (!order) return;
    setError(null);
    try {
      const html = await fetchDocumentHtml(order.orderNumber, kind);
      const w = window.open("", "_blank");
      if (!w) {
        setError("Please allow pop-ups to open the document.");
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't open the document.");
    }
  }

  const addr = order?.shippingAddress;
  const canShip = order && !order.shipment && (order.status === "CONFIRMED" || order.status === "PACKED");

  return (
    <Shell title={order ? `Order ${order.orderNumber}` : "Order"}>
      <Link href="/orders" className="back-link">← All orders</Link>
      {state === "loading" && <p className="muted">Loading…</p>}
      {state === "error" && <p className="muted">Order not found.</p>}
      {state === "ready" && order && (
        <>
          <div className="page-head">
            <div>
              <h1>{order.orderNumber}</h1>
              <p className="muted">
                {new Date(order.placedAt).toLocaleString("en-IN")} · {order.channel?.name ?? "—"} ·{" "}
                <span className={`pill ${order.status.toLowerCase()}`}>{order.status}</span>
              </p>
            </div>
            <div className="status-actions">
              {NEXT[order.status].length === 0 ? (
                <span className="muted">No further actions</span>
              ) : (
                NEXT[order.status].map((s) => (
                  <button
                    key={s}
                    className={`btn sm ${s === "CANCELLED" || s === "RETURNED" ? "danger" : "primary"}`}
                    disabled={busy}
                    onClick={() => changeStatus(s)}
                  >
                    Mark {s.toLowerCase()}
                  </button>
                ))
              )}
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}

          <div className="two-col">
            <div className="card">
              <div className="card-head"><h2>Items</h2></div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Item</th><th>SKU</th><th className="num">Qty</th><th className="num">Unit</th><th className="num">Total</th></tr></thead>
                  <tbody>
                    {order.items.map((it) => (
                      <tr key={it.id}>
                        <td className="strong">{it.titleSnapshot}</td>
                        <td className="muted">{it.skuSnapshot}</td>
                        <td className="num">{it.quantity}</td>
                        <td className="num">{formatMoney(it.unitPriceMinor, order.currency)}</td>
                        <td className="num">{formatMoney(it.totalMinor, order.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="card">
                <div className="card-head"><h2>Summary</h2></div>
                <div className="card-body">
                  <dl style={{ margin: 0 }}>
                    <div className="kv"><dt>Subtotal</dt><dd>{formatMoney(order.subtotalMinor, order.currency)}</dd></div>
                    <div className="kv"><dt>GST</dt><dd>{formatMoney(order.taxMinor, order.currency)}</dd></div>
                    <div className="kv"><dt>Shipping</dt><dd>{order.shippingMinor === 0 ? "Free" : formatMoney(order.shippingMinor, order.currency)}</dd></div>
                    <div className="kv"><dt className="strong">Total</dt><dd className="strong">{formatMoney(order.totalMinor, order.currency)}</dd></div>
                    <div className="kv"><dt>Payment</dt><dd><span className={`pill ${(order.payment?.status ?? "").toLowerCase()}`}>{order.payment?.status ?? "—"}</span> {order.payment?.provider ?? ""}</dd></div>
                  </dl>
                </div>
              </div>

              <div className="card">
                <div className="card-head"><h2>Ship to</h2></div>
                <div className="card-body">
                  {addr ? (
                    <address style={{ fontStyle: "normal", fontSize: 14, lineHeight: 1.7 }}>
                      <div className="strong">{addr.name}</div>
                      <div>{addr.line1}</div>
                      {addr.line2 && <div>{addr.line2}</div>}
                      <div>{addr.city}, {addr.state} {addr.pincode}</div>
                      <div className="muted">{addr.phone}</div>
                    </address>
                  ) : (
                    <p className="muted">No address on file.</p>
                  )}
                  {order.customer && (
                    <p style={{ marginTop: 12 }}>
                      <Link href={`/customers/${order.customer.id}`} className="link-btn">
                        {order.customer.name ?? order.customer.email} →
                      </Link>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Fulfilment</h2>
              <div className="status-actions">
                <button className="btn sm" onClick={() => openDoc("invoice")}>Invoice</button>
                <button className="btn sm" onClick={() => openDoc("delivery-note")}>Delivery note</button>
                <button className="btn sm" onClick={() => openDoc("label")}>Label</button>
              </div>
            </div>
            <div className="card-body">
              {canShip && (
                <button className="btn primary" disabled={busy} onClick={bookShipment}>
                  {busy ? "Booking…" : "Book shipment"}
                </button>
              )}
              {!order.shipment && !canShip && (
                <p className="muted">Confirm the order to book a shipment. The documents above are available now.</p>
              )}
              {order.shipment && (
                <>
                  <dl style={{ margin: "0 0 14px" }}>
                    <div className="kv"><dt>Courier</dt><dd>{order.shipment.courierName}</dd></div>
                    <div className="kv"><dt>AWB</dt><dd className="strong">{order.shipment.awb ?? "—"}</dd></div>
                    <div className="kv"><dt>Status</dt><dd><span className={`pill ${order.shipment.status.toLowerCase()}`}>{order.shipment.status.replace(/_/g, " ")}</span></dd></div>
                  </dl>
                  {order.shipment.status !== "DELIVERED" && (
                    <button className="btn sm" disabled={busy} onClick={sync}>
                      {busy ? "Syncing…" : "Sync tracking →"}
                    </button>
                  )}
                  <div style={{ marginTop: 16 }}>
                    {order.shipment.events.length === 0 ? (
                      <p className="muted">No tracking updates yet.</p>
                    ) : (
                      order.shipment.events.map((e) => (
                        <div key={e.id} className="kv">
                          <dt>{e.status}{e.location ? ` · ${e.location}` : ""}</dt>
                          <dd className="muted">{new Date(e.occurredAt).toLocaleString("en-IN")}</dd>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}
