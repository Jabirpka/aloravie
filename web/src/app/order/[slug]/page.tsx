"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { formatMoney } from "@/lib/money";
import type { Order } from "@/lib/types";
import { getOrder } from "@/lib/client";

const STATUS_LABEL: Record<Order["status"], string> = {
  PENDING: "Awaiting payment",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
};

export default function OrderPage() {
  const params = useParams<{ slug: string }>();
  const orderNumber = params.slug;
  const { customer, loading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (loading) return;
    if (!customer) {
      setState("error");
      return;
    }
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
  }, [orderNumber, customer, loading]);

  if (loading || state === "loading") {
    return <section className="container section"><p className="muted">Loading your order…</p></section>;
  }

  if (state === "error" || !order) {
    return (
      <section className="container section narrow">
        <h1 className="checkout-h">Order not found</h1>
        <p className="muted">
          {customer ? "We couldn't find that order on your account." : "Please sign in to view your order."}
        </p>
        <Link href={customer ? "/account/orders" : "/account"} className="btn primary">
          {customer ? "My orders" : "Sign in"}
        </Link>
      </section>
    );
  }

  const paid = order.payment?.status === "PAID";

  return (
    <section className="container section narrow">
      <div className="order-confirm">
        <p className="eyebrow">{paid ? "Thank you" : "Order"}</p>
        <h1 className="checkout-h">
          {paid ? "Your order is confirmed." : `Order ${order.orderNumber}`}
        </h1>
        <p className="muted order-meta">
          {order.orderNumber} · <span className={`status-pill status-${order.status.toLowerCase()}`}>{STATUS_LABEL[order.status]}</span>
        </p>

        <div className="order-items">
          {order.items.map((it) => (
            <div key={it.id} className="order-item">
              <div>
                <div className="order-item-title">{it.titleSnapshot}</div>
                <div className="muted order-item-sku">{it.skuSnapshot} · ×{it.quantity}</div>
              </div>
              <div className="order-item-price">{formatMoney(it.totalMinor, order.currency)}</div>
            </div>
          ))}
        </div>

        <div className="order-totals">
          <div className="summary-row"><span>Subtotal</span><span>{formatMoney(order.subtotalMinor, order.currency)}</span></div>
          <div className="summary-row"><span>GST</span><span>{formatMoney(order.taxMinor, order.currency)}</span></div>
          <div className="summary-row"><span>Shipping</span><span>{order.shippingMinor === 0 ? "Free" : formatMoney(order.shippingMinor, order.currency)}</span></div>
          <div className="summary-row total"><span>Total paid</span><span>{formatMoney(order.totalMinor, order.currency)}</span></div>
        </div>

        <div className="order-actions">
          <Link href="/account/orders" className="btn ghost">My orders</Link>
          <Link href="/shop" className="btn primary">Continue shopping</Link>
        </div>
      </div>
    </section>
  );
}
