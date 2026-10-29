"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import type { Address, AddressInput } from "@/lib/types";
import { ApiRequestError, createAddress, deleteAddress, listAddresses, updateAddress } from "@/lib/client";

const EMPTY: AddressInput = { name: "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "" };

export default function AddressesPage() {
  const { customer, loading } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [form, setForm] = useState<AddressInput>(EMPTY);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AddressInput>(EMPTY);

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

  function startEdit(a: Address) {
    setEditingId(a.id);
    setEditForm({ name: a.name, phone: a.phone, line1: a.line1, line2: a.line2 ?? "", city: a.city, state: a.state, pincode: a.pincode });
    setAdding(false);
    setError(null);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setBusy(true);
    setError(null);
    try {
      await updateAddress(editingId, editForm);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't update the address.");
    } finally {
      setBusy(false);
    }
  }

  async function makeDefault(id: string) {
    try {
      await updateAddress(id, { isDefault: true });
      await load();
    } catch {
      setError("Couldn't set that as your default.");
    }
  }

  function f(k: keyof AddressInput, v: string) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  function ef(k: keyof AddressInput, v: string) {
    setEditForm((s) => ({ ...s, [k]: v }));
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
          {addresses.map((a) =>
            editingId === a.id ? (
              <form key={a.id} className="auth-form address-card" style={{ display: "block" }} onSubmit={saveEdit}>
                <label><span>Full name</span><input value={editForm.name} onChange={(e) => ef("name", e.target.value)} required /></label>
                <label><span>Phone</span><input value={editForm.phone} onChange={(e) => ef("phone", e.target.value)} required /></label>
                <label><span>Address line 1</span><input value={editForm.line1} onChange={(e) => ef("line1", e.target.value)} required /></label>
                <label><span>Address line 2 (optional)</span><input value={editForm.line2} onChange={(e) => ef("line2", e.target.value)} /></label>
                <label><span>City</span><input value={editForm.city} onChange={(e) => ef("city", e.target.value)} required /></label>
                <label><span>State</span><input value={editForm.state} onChange={(e) => ef("state", e.target.value)} required /></label>
                <label><span>PIN code</span><input value={editForm.pincode} onChange={(e) => ef("pincode", e.target.value)} inputMode="numeric" pattern="\d{6}" title="6-digit PIN" required /></label>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
                  <button className="btn ghost" type="button" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </form>
            ) : (
              <div key={a.id} className="address-card">
                <div>
                  <div className="strong">{a.name} {a.isDefault && <span className="status-pill status-confirmed">Default</span>}</div>
                  <div>{a.line1}{a.line2 ? `, ${a.line2}` : ""}</div>
                  <div>{a.city}, {a.state} {a.pincode}</div>
                  <div className="muted">{a.phone}</div>
                  <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
                    <button className="link-btn" onClick={() => startEdit(a)}>Edit</button>
                    {!a.isDefault && <button className="link-btn" onClick={() => makeDefault(a.id)}>Make default</button>}
                    <button className="link-btn danger" onClick={() => remove(a.id)}>Remove</button>
                  </div>
                </div>
              </div>
            ),
          )}
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
