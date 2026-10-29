"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/components/AdminAuthProvider";
import { ApiRequestError, getCustomer, resetCustomerPassword, updateCustomerAddress, type AddressPatch } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import type { CustomerDetail } from "@/lib/types";

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [resetBusy, setResetBusy] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  async function doReset() {
    const ok = window.confirm(
      "Only reset after you've confirmed the customer's identity (order number + registered email/phone).\n\nThis sets a temporary password and signs them out everywhere. Continue?",
    );
    if (!ok) return;
    setResetBusy(true);
    setResetError(null);
    setTempPassword(null);
    try {
      const res = await resetCustomerPassword(params.id);
      setTempPassword(res.tempPassword);
    } catch (err) {
      setResetError(err instanceof ApiRequestError ? err.message : "Couldn't reset the password.");
    } finally {
      setResetBusy(false);
    }
  }

  const [editAddrId, setEditAddrId] = useState<string | null>(null);
  const [addrForm, setAddrForm] = useState<AddressPatch>({});
  const [addrBusy, setAddrBusy] = useState(false);
  const [addrError, setAddrError] = useState<string | null>(null);

  function startEditAddr(a: CustomerDetail["addresses"][number]) {
    setEditAddrId(a.id);
    setAddrForm({ name: a.name, phone: a.phone, line1: a.line1, line2: a.line2 ?? "", city: a.city, state: a.state, pincode: a.pincode });
    setAddrError(null);
  }

  async function saveAddr(e: React.FormEvent) {
    e.preventDefault();
    if (!editAddrId) return;
    setAddrBusy(true);
    setAddrError(null);
    try {
      await updateCustomerAddress(params.id, editAddrId, addrForm);
      setEditAddrId(null);
      setCustomer(await getCustomer(params.id));
    } catch (err) {
      setAddrError(err instanceof ApiRequestError ? err.message : "Couldn't update the address.");
    } finally {
      setAddrBusy(false);
    }
  }

  function af(k: keyof AddressPatch, v: string) {
    setAddrForm((s) => ({ ...s, [k]: v }));
  }

  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    getCustomer(params.id)
      .then((c) => {
        if (!active) return;
        setCustomer(c);
        setState("ready");
      })
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, [params.id, user, loading]);

  const lifetime = customer?.orders
    .filter((o) => ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"].includes(o.status))
    .reduce((s, o) => s + o.totalMinor, 0);

  return (
    <Shell title={customer?.name ?? "Customer"}>
      <Link href="/customers" className="back-link">← All customers</Link>
      {state === "loading" && <p className="muted">Loading…</p>}
      {state === "error" && <p className="muted">Customer not found.</p>}
      {state === "ready" && customer && (
        <>
          <div className="page-head">
            <h1>{customer.name ?? "Unnamed customer"}</h1>
            <span className="muted">Joined {new Date(customer.createdAt).toLocaleDateString("en-IN")}</span>
          </div>

          <div className="two-col">
            <div className="card">
              <div className="card-head"><h2>Orders ({customer.orders.length})</h2></div>
              <div className="table-wrap">
                {customer.orders.length === 0 ? (
                  <div className="empty">No orders yet.</div>
                ) : (
                  <table className="table">
                    <thead><tr><th>Order</th><th>Date</th><th>Status</th><th className="num">Items</th><th className="num">Total</th></tr></thead>
                    <tbody>
                      {customer.orders.map((o) => (
                        <tr key={o.id}>
                          <td className="strong"><Link href={`/orders/${o.orderNumber}`}>{o.orderNumber}</Link></td>
                          <td className="muted">{new Date(o.placedAt).toLocaleDateString("en-IN")}</td>
                          <td><span className={`pill ${o.status.toLowerCase()}`}>{o.status}</span></td>
                          <td className="num">{o._count.items}</td>
                          <td className="num">{formatMoney(o.totalMinor, o.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div>
              <div className="card">
                <div className="card-head"><h2>Profile</h2></div>
                <div className="card-body">
                  <dl style={{ margin: 0 }}>
                    <div className="kv"><dt>Email</dt><dd>{customer.email ?? "—"}</dd></div>
                    <div className="kv"><dt>Phone</dt><dd>{customer.phone ?? "—"}</dd></div>
                    <div className="kv"><dt>Orders</dt><dd>{customer.orders.length}</dd></div>
                    <div className="kv"><dt className="strong">Lifetime spend</dt><dd className="strong">{formatMoney(lifetime ?? 0)}</dd></div>
                  </dl>
                </div>
              </div>

              <div className="card">
                <div className="card-head"><h2>Account access</h2></div>
                <div className="card-body">
                  {tempPassword ? (
                    <>
                      <p className="muted" style={{ marginTop: 0 }}>Temporary password — read or send this to the customer, then have them change it after signing in:</p>
                      <p className="strong" style={{ fontSize: 18, letterSpacing: 1, userSelect: "all", background: "var(--surface, #f6f3ee)", padding: "8px 12px", borderRadius: 6 }}>{tempPassword}</p>
                      <p className="muted" style={{ fontSize: 12 }}>Shown once. They&rsquo;ll be prompted to set their own password on first sign-in.</p>
                    </>
                  ) : (
                    <p className="muted" style={{ marginTop: 0 }}>Reset the password for a locked-out customer. Verify who they are first.</p>
                  )}
                  {resetError && <p className="form-error">{resetError}</p>}
                  <button className="btn sm" disabled={resetBusy} onClick={doReset}>
                    {resetBusy ? "Resetting…" : tempPassword ? "Reset again" : "Reset password"}
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="card-head"><h2>Addresses</h2></div>
                <div className="card-body">
                  {addrError && <p className="form-error">{addrError}</p>}
                  {customer.addresses.length === 0 ? (
                    <p className="muted">No saved addresses.</p>
                  ) : (
                    customer.addresses.map((a) =>
                      editAddrId === a.id ? (
                        <form key={a.id} onSubmit={saveAddr} style={{ marginBottom: 14, display: "grid", gap: 8 }}>
                          <input value={addrForm.name ?? ""} onChange={(e) => af("name", e.target.value)} placeholder="Full name" required />
                          <input value={addrForm.phone ?? ""} onChange={(e) => af("phone", e.target.value)} placeholder="Phone" required />
                          <input value={addrForm.line1 ?? ""} onChange={(e) => af("line1", e.target.value)} placeholder="Address line 1" required />
                          <input value={addrForm.line2 ?? ""} onChange={(e) => af("line2", e.target.value)} placeholder="Address line 2 (optional)" />
                          <input value={addrForm.city ?? ""} onChange={(e) => af("city", e.target.value)} placeholder="City" required />
                          <input value={addrForm.state ?? ""} onChange={(e) => af("state", e.target.value)} placeholder="State" required />
                          <input value={addrForm.pincode ?? ""} onChange={(e) => af("pincode", e.target.value)} placeholder="PIN code" inputMode="numeric" pattern="\d{6}" title="6-digit PIN code" required />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="btn sm primary" type="submit" disabled={addrBusy}>{addrBusy ? "Saving…" : "Save"}</button>
                            <button className="btn sm" type="button" onClick={() => setEditAddrId(null)}>Cancel</button>
                          </div>
                        </form>
                      ) : (
                        <address key={a.id} style={{ fontStyle: "normal", fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>
                          <div className="strong">{a.name}</div>
                          <div>{a.line1}{a.line2 ? `, ${a.line2}` : ""}</div>
                          <div>{a.city}, {a.state} {a.pincode}</div>
                          <div className="muted">{a.phone}</div>
                          <button className="link-btn" type="button" onClick={() => startEditAddr(a)} style={{ marginTop: 4 }}>Edit</button>
                        </address>
                      ),
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}
