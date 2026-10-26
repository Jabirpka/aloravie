"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/components/AdminAuthProvider";
import { adjustInventory, listInventory, ApiRequestError } from "@/lib/api";
import type { InventoryRow } from "@/lib/types";

export default function InventoryPage() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [lowOnly, setLowOnly] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const data = await listInventory(lowOnly);
      setRows(data);
      setDrafts(Object.fromEntries(data.map((r) => [r.id, String(r.onHand)])));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [lowOnly]);

  useEffect(() => {
    if (loading || !user) return;
    void load();
  }, [user, loading, load]);

  async function save(row: InventoryRow) {
    const raw = drafts[row.id];
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) {
      setError(`Enter a whole number ≥ 0 for ${row.sku}`);
      return;
    }
    setError(null);
    setSavingId(row.id);
    try {
      await adjustInventory({ variantId: row.variantId, locationId: row.locationId, setOnHand: value });
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't update stock.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Shell title="Inventory">
      <div className="filters">
        <button className={`chip ${!lowOnly ? "active" : ""}`} onClick={() => setLowOnly(false)}>All stock</button>
        <button className={`chip ${lowOnly ? "active" : ""}`} onClick={() => setLowOnly(true)}>Low stock</button>
      </div>
      {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}

      <div className="card">
        <div className="table-wrap">
          {state === "loading" && <div className="empty">Loading…</div>}
          {state === "error" && <div className="empty">Couldn&rsquo;t load inventory.</div>}
          {state === "ready" &&
            (rows.length === 0 ? (
              <div className="empty">{lowOnly ? "Nothing is low on stock." : "No inventory yet. Seed the database."}</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th><th>Variant</th><th>SKU</th><th>Location</th>
                    <th className="num">Reserved</th><th className="num">Available</th>
                    <th className="num">On hand</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="strong">{r.product}</td>
                      <td>{r.variantName}</td>
                      <td className="muted">{r.sku}</td>
                      <td>{r.location}</td>
                      <td className="num">{r.reserved}</td>
                      <td className="num">{r.low ? <span className="pill low">{r.available}</span> : r.available}</td>
                      <td className="num">
                        <input
                          className="stock-input"
                          inputMode="numeric"
                          value={drafts[r.id] ?? ""}
                          onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                        />
                      </td>
                      <td>
                        <button
                          className="btn sm primary"
                          disabled={savingId === r.id || drafts[r.id] === String(r.onHand)}
                          onClick={() => save(r)}
                        >
                          {savingId === r.id ? "Saving…" : "Set"}
                        </button>
                      </td>
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
