"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/components/AdminAuthProvider";
import { ApiRequestError, getChannel, pullChannelOrders, pushChannelInventory } from "@/lib/api";
import type { ChannelDetail } from "@/lib/types";

export default function ChannelDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const [channel, setChannel] = useState<ChannelDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setChannel(await getChannel(params.id));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [params.id]);

  useEffect(() => {
    if (loading || !user) return;
    void load();
  }, [user, loading, load]);

  async function act(action: "push" | "pull") {
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      if (action === "push") {
        const r = await pushChannelInventory(params.id);
        setNote(`Pushed stock for ${r.pushed} listing${r.pushed === 1 ? "" : "s"}.`);
      } else {
        const r = await pullChannelOrders(params.id);
        setNote(`Imported ${r.created} order${r.created === 1 ? "" : "s"}${r.skipped ? `, skipped ${r.skipped}` : ""}.`);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title={channel?.name ?? "Channel"}>
      <Link href="/channels" className="back-link">← All channels</Link>
      {state === "loading" && <p className="muted">Loading…</p>}
      {state === "error" && <p className="muted">Channel not found.</p>}
      {state === "ready" && channel && (
        <>
          <div className="page-head">
            <div>
              <h1>{channel.name}</h1>
              <p className="muted">
                <span className={`pill ${channel.connected ? "ok" : ""}`}>{channel.connected ? "Connected" : "Not connected"}</span>
                {" "}· {channel._count.orders} order{channel._count.orders === 1 ? "" : "s"}
              </p>
            </div>
            {channel.type !== "WEB" && channel.connected && (
              <div className="status-actions">
                <button className="btn sm" disabled={busy} onClick={() => act("push")}>Push stock</button>
                <button className="btn sm primary" disabled={busy} onClick={() => act("pull")}>Pull orders</button>
              </div>
            )}
          </div>
          {note && <p style={{ color: "var(--ok)", marginBottom: 12 }}>{note}</p>}
          {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}

          <div className="two-col">
            <div className="card">
              <div className="card-head"><h2>Listings ({channel.listings.length})</h2></div>
              <div className="table-wrap">
                {channel.listings.length === 0 ? (
                  <div className="empty">No listings. Connect the channel to list your active catalogue.</div>
                ) : (
                  <table className="table">
                    <thead><tr><th>Product</th><th>Our SKU</th><th>Marketplace SKU</th><th className="num">Last pushed</th></tr></thead>
                    <tbody>
                      {channel.listings.map((l) => (
                        <tr key={l.id}>
                          <td className="strong">{l.variant.product.title}<div className="muted" style={{ fontWeight: 400 }}>{l.variant.name}</div></td>
                          <td className="muted">{l.variant.sku}</td>
                          <td>{l.externalSku}</td>
                          <td className="num">{l.lastPushedQty ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-head"><h2>Sync history</h2></div>
              <div className="card-body">
                {channel.syncLogs.length === 0 ? (
                  <p className="muted">No syncs yet.</p>
                ) : (
                  channel.syncLogs.map((log) => (
                    <div key={log.id} className="kv">
                      <dt>
                        <span className={`pill ${log.status === "OK" ? "ok" : log.status === "FAILED" ? "cancelled" : ""}`}>
                          {log.type === "INVENTORY_PUSH" ? "Stock" : "Orders"}
                        </span>{" "}
                        {log.message}
                      </dt>
                      <dd className="muted">{new Date(log.createdAt).toLocaleString("en-IN")}</dd>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}
