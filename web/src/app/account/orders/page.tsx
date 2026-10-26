"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { formatMoney } from "@/lib/money";
import type { Order } from "@/lib/types";
import { listOrders } from "@/lib/client";

export default function OrdersPage() {
  const { customer, loading } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (loading) return;
    if (!customer) {
      setState("error");
      return;
    }
    let active = true;
    listOrders()
      .then((o) => {
        if (!active) return;
        setOrders(o);
        setState("ready");
      })
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, [customer, loading]);

  if (loading || state === "loading") {
    return <section className="container section"><p className="muted">Loading…</p></section>;
  }

  if (!customer) {
    return (
      <section className="container section narrow">
        <h1 className="checkout-h">Sign in</h1>
        <Link href="/account?next=/account/orders" className="btn primary">Sign in</Link>
      </section>
    );
  }

  return (
    <section className="container section narrow">
      <p className="eyebrow">Your account</p>
      <h1 className="checkout-h">My orders</h1>

      {!orders || orders.length === 0 ? (
        <p className="muted">No orders yet. <Link href="/shop" className="section-link">Start shopping →</Link></p>
      ) : (
        <div className="orders-list">
          {orders.map((o) => (
            <Link key={o.id} href={`/order/${o.orderNumber}`} className="orders-row">
              <div>
                <div className="orders-number">{o.orderNumber}</div>
                <div className="muted orders-date">{new Date(o.placedAt).toLocaleDateString("en-IN")} · {o.items.length} {o.items.length === 1 ? "item" : "items"}</div>
              </div>
              <div className="orders-right">
                <span className={`status-pill status-${o.status.toLowerCase()}`}>{o.status}</span>
                <span className="orders-total">{formatMoney(o.totalMinor, o.currency)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
