"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/components/AdminAuthProvider";
import { ApiRequestError, createCoupon, listCoupons, updateCoupon } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import type { Coupon } from "@/lib/types";

export default function CouponsPage() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<Coupon[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    code: "", description: "", type: "PERCENT" as "PERCENT" | "FIXED",
    value: "", minSpend: "", usageLimit: "", endsAt: "",
  });

  const load = useCallback(async () => {
    try {
      setRows(await listCoupons());
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    void load();
  }, [user, loading, load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createCoupon({
        code: form.code,
        description: form.description || undefined,
        type: form.type,
        value: form.type === "PERCENT" ? Number(form.value) : Math.round(Number(form.value) * 100),
        minSpendMinor: form.minSpend ? Math.round(Number(form.minSpend) * 100) : 0,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      });
      setForm({ code: "", description: "", type: "PERCENT", value: "", minSpend: "", usageLimit: "", endsAt: "" });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't create the coupon.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(c: Coupon) {
    try {
      await updateCoupon(c.id, { active: !c.active });
      await load();
    } catch {
      setError("Couldn't update the coupon.");
    }
  }

  return (
    <Shell title="Coupons">
      {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}
      {open ? (
        <div className="card">
          <div className="card-head"><h2>New coupon</h2></div>
          <form className="card-body" onSubmit={add}>
            <div className="field-grid">
              <label><span>Code</span><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required placeholder="WELCOME10" /></label>
              <label><span>Description</span><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
              <label><span>Type</span>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "PERCENT" | "FIXED" })}>
                  <option value="PERCENT">Percentage off</option>
                  <option value="FIXED">Fixed amount off (₹)</option>
                </select>
              </label>
              <label><span>{form.type === "PERCENT" ? "Percent (1–100)" : "Amount off (₹)"}</span><input type="number" min="1" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required /></label>
              <label><span>Min spend (₹, optional)</span><input type="number" min="0" value={form.minSpend} onChange={(e) => setForm({ ...form, minSpend: e.target.value })} /></label>
              <label><span>Usage limit (optional)</span><input type="number" min="1" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} /></label>
              <label><span>Ends (optional)</span><input type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></label>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button className="btn primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Create coupon"}</button>
              <button className="btn" type="button" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : (
        <button className="btn primary" style={{ marginBottom: 18 }} onClick={() => setOpen(true)}>+ New coupon</button>
      )}

      <div className="card">
        <div className="table-wrap">
          {state === "loading" && <div className="empty">Loading…</div>}
          {state === "error" && <div className="empty">Couldn&rsquo;t load coupons.</div>}
          {state === "ready" &&
            (rows.length === 0 ? (
              <div className="empty">No coupons yet.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Code</th><th>Discount</th><th>Min spend</th><th className="num">Used</th><th>Ends</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <td className="strong">{c.code}{c.description && <div className="muted" style={{ fontWeight: 400 }}>{c.description}</div>}</td>
                      <td>{c.type === "PERCENT" ? `${c.value}%` : formatMoney(c.value, c.currency)}</td>
                      <td>{c.minSpendMinor ? formatMoney(c.minSpendMinor, c.currency) : "—"}</td>
                      <td className="num">{c.usedCount}{c.usageLimit != null ? ` / ${c.usageLimit}` : ""}</td>
                      <td className="muted">{c.endsAt ? new Date(c.endsAt).toLocaleDateString("en-IN") : "—"}</td>
                      <td><span className={`pill ${c.active ? "ok" : "cancelled"}`}>{c.active ? "Active" : "Off"}</span></td>
                      <td><button className="btn sm" onClick={() => toggle(c)}>{c.active ? "Disable" : "Enable"}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
        </div>
      </div>
    </Shell>
  );
}
