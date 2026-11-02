"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/components/AdminAuthProvider";
import { ApiRequestError, listTeamMessages, postTeamMessage, type StaffMessage } from "@/lib/api";

export default function TeamPage() {
  const { user, loading } = useAuth();
  const [messages, setMessages] = useState<StaffMessage[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMessages(await listTeamMessages());
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    void load();
    // Light polling so new notes appear without a manual refresh.
    const t = setInterval(() => void load(), 20000);
    return () => clearInterval(t);
  }, [user, loading, load]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await postTeamMessage(body.trim());
      setBody("");
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't post your message.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Team board">
      <div className="card" style={{ maxWidth: 680 }}>
        <div className="card-head"><h2>Post a note</h2></div>
        <form className="card-body" onSubmit={post}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Share an update with the team…"
            style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--bg)", color: "var(--text)", font: "inherit" }}
          />
          {error && <p className="form-error" style={{ marginTop: 8 }}>{error}</p>}
          <button className="btn primary" type="submit" disabled={busy || !body.trim()} style={{ marginTop: 10 }}>{busy ? "Posting…" : "Post"}</button>
        </form>
      </div>

      <div style={{ maxWidth: 680, marginTop: 18 }}>
        {state === "loading" && <p className="muted">Loading…</p>}
        {state === "error" && <p className="muted">Couldn&rsquo;t load messages.</p>}
        {state === "ready" && messages.length === 0 && <p className="muted">No messages yet. Be the first to post.</p>}
        {state === "ready" &&
          messages.map((m) => (
            <div key={m.id} className="card" style={{ marginBottom: 10 }}>
              <div className="card-body">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                  <span className="strong">{m.authorName}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{new Date(m.createdAt).toLocaleString("en-IN")}</span>
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
              </div>
            </div>
          ))}
      </div>
    </Shell>
  );
}
