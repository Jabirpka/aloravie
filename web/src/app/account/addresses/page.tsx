"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import type { Address, AddressInput } from "@/lib/types";
import { ApiRequestError, createAddress, deleteAddress, listAddresses } from "@/lib/client";

const EMPTY: AddressInput = { name: "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "" };

export default function AddressesPage() {
  const { customer, loading } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [form, setForm] = useState<AddressInput>(EMPTY);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAddresses(await listAddresses());
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (loading || !customer) return;
    void load();
  }, [customer, loading, load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createAddress({ ...form, isDefault: addresses.length === 0 });
      setForm(EMPTY);
      setAdding(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't save the address.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteAddress(id);
      await load();
    } catch {
      setError("Couldn't remove the address.");
    }
  }

  function f(k: keyof AddressInput, v: string) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  if (loading) return <section className="container section"><p className="muted">Loading…</p></section>;
  if (!customer) {
    return (
      <section className="container section narrow">
        <h1 className="checkout-h">Sign in</h1>
        <Link href="/account?next=/account/addresses" className="btn primary">Sign in</Link>
      </section>
    );
  }

  return (
    <section className="container section narrow">
      <p className="eyebrow">Your account</p>
      <h1 className="checkout-h">Saved addresses</h1>

      {state === "ready" && addresses.length > 0 && (
        <div className="address-list">
          {addresses.map((a) => (
            <div key={a.id} className="address-card">
              <div>
                <div className="strong">{a.name} {a.isDefault && <span className="status-pill status-confirmed">Default</span>}</div>
                <div>{a.line1}{a.line2 ? `, ${a.line2}` : ""}</div>
                <div>{a.city}, {a.state} {a.pincode}</div>
                <div className="muted">{a.phone}</div>
              </div>
              <button className="link-btn danger" onClick={() => remove(a.id)}>Remove</button>
            </div>
          ))}
        </div>
      )}
      {state === "ready" && addresses.length === 0 && <p className="muted">No saved addresses yet.</p>}
      {error && <p className="form-error">{error}</p>}

      {adding ? (
        <form className="auth-form" style={{ marginTop: 20 }} onSubmit={add}>
          <label><span>Full name</span><input value={form.name} onChange={(e) => f("name", e.target.value)} required /></label>
          <label><span>Phone</span><input value={form.phone} onChange={(e) => f("phone", e.target.value)} required /></label>
          <label><span>Address line 1</span><input value={form.line1} onChange={(e) => f("line1", e.target.value)} required /></label>
          <label><span>Address line 2 (optional)</span><input value={form.line2} onChange={(e) => f("line2", e.target.value)} /></label>
          <label><span>City</span><input value={form.city} onChange={(e) => f("city", e.target.value)} required /></label>
          <label><span>State</span><input value={form.state} onChange={(e) => f("state", e.target.value)} required /></label>
          <label><span>PIN code</span><input value={form.pincode} onChange={(e) => f("pincode", e.target.value)} inputMode="numeric" pattern="\d{6}" title="6-digit PIN" required /></label>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save address"}</button>
            <button className="btn ghost" type="button" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <button className="btn primary" style={{ marginTop: 20 }} onClick={() => setAdding(true)}>+ Add address</button>
      )}
    </section>
  );
}
