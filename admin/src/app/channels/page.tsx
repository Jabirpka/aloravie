"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/components/AdminAuthProvider";
import {
  ApiRequestError,
  connectChannel,
  listChannels,
  pullChannelOrders,
  pushChannelInventory,
} from "@/lib/api";
import type { ChannelRow } from "@/lib/types";

export default function ChannelsPage() {
  const { user, loading } = useAuth();
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setChannels(await listChannels());
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    void load();
  }, [user, loading, load]);

  async function run(id: string, action: "connect" | "push" | "pull") {
    setError(null);
    setNote(null);
    setBusyId(id);
    try {
      if (action === "connect") {
        await connectChannel(id);
        setNote("Channel connected and catalogue listed.");
      } else if (action === "push") {
        const r = await pushChannelInventory(id);
        setNote(`Pushed stock for ${r.pushed} listing${r.pushed === 1 ? "" : "s"}.`);
      } else {
        const r = await pullChannelOrders(id);
        setNote(`Imported ${r.created} order${r.created === 1 ? "" : "s"}${r.skipped ? `, skipped ${r.skipped}` : ""}.`);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Shell title="Channels">
      <p className="muted" style={{ marginBottom: 16, maxWidth: "70ch" }}>
        Connect a marketplace to list your active catalogue, push one shared stock pool, and import
        its orders into the same pipeline. Running in simulation unless live credentials are set.
      </p>
      {note && <p style={{ marginBottom: 12, color: "var(--ok)" }}>{note}</p>}
      {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}

      <div className="card">
        <div className="table-wrap">
          {state === "loading" && <div className="empty">Loading…</div>}
          {state === "error" && <div className="empty">Couldn&rsquo;t load channels.</div>}
          {state === "ready" && (
            <table className="table">
              <thead>
                <tr>
                  <th>Channel</th><th>Status</th><th className="num">Listings</th>
                  <th className="num">Orders</th><th>Last order sync</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((c) => {
                  const isWeb = c.type === "WEB";
                  return (
                    <tr key={c.id}>
                      <td className="strong">
                        {c.connected || isWeb ? <Link href={`/channels/${c.id}`}>{c.name}</Link> : c.name}
                      </td>
                      <td>
                        {isWeb ? (
                          <span className="pill ok">Native</span>
                        ) : c.connected ? (
                          <span className="pill ok">Connected</span>
                        ) : (
                          <span className="pill">Not connected</span>
                        )}
                      </td>
                      <td className="num">{isWeb ? "—" : c.listingCount}</td>
                      <td className="num">{c.orderCount}</td>
                      <td className="muted">{c.lastOrderSyncAt ? new Date(c.lastOrderSyncAt).toLocaleString("en-IN") : "—"}</td>
                      <td>
                        {isWeb ? (
                          <span className="muted">—</span>
                        ) : (
                          <div className="status-actions">
                            {!c.connected ? (
                              <button className="btn sm primary" disabled={busyId === c.id} onClick={() => run(c.id, "connect")}>
                                {busyId === c.id ? "…" : "Connect"}
                              </button>
                            ) : (
                              <>
                                <button className="btn sm" disabled={busyId === c.id} onClick={() => run(c.id, "push")}>Push stock</button>
                                <button className="btn sm" disabled={busyId === c.id} onClick={() => run(c.id, "pull")}>Pull orders</button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Shell>
  );
}
