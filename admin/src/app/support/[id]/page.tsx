"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/components/AdminAuthProvider";
import { ApiRequestError, assetUrl, closeSupport, getSupport, replySupport } from "@/lib/api";
import type { SupportConversationDetail } from "@/lib/types";

export default function SupportDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const [convo, setConvo] = useState<SupportConversationDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setConvo(await getSupport(params.id));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [params.id]);

  useEffect(() => {
    if (loading || !user) return;
    void load();
  }, [user, loading, load]);

  // Poll for new customer messages.
  useEffect(() => {
    if (state !== "ready") return;
    const t = window.setInterval(() => void load(), 6000);
    return () => window.clearInterval(t);
  }, [state, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [convo?.messages.length]);

  async function reply() {
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setConvo(await replySupport(params.id, draft.trim()));
      setDraft("");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't send the reply.");
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    setBusy(true);
    try {
      setConvo(await closeSupport(params.id));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't close.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title={convo?.subject ?? "Conversation"}>
      <Link href="/support" className="back-link">← Support inbox</Link>
      {state === "loading" && <p className="muted">Loading…</p>}
      {state === "error" && <p className="muted">Conversation not found.</p>}
      {state === "ready" && convo && (
        <>
          <div className="page-head">
            <div>
              <h1>{convo.subject}</h1>
              <p className="muted">
                {convo.customer?.name ?? convo.customer?.email ?? "Guest"} ·{" "}
                <span className={`pill ${convo.status === "OPEN" ? "pending" : "cancelled"}`}>{convo.status}</span>
              </p>
            </div>
            {convo.status === "OPEN" && (
              <button className="btn sm" disabled={busy} onClick={close}>Close conversation</button>
            )}
          </div>

          <div className="card">
            <div className="card-body admin-chat">
              {convo.messages.map((m) => (
                <div key={m.id} className={`abubble ${m.sender === "STAFF" ? "staff" : m.sender === "SYSTEM" ? "system" : "customer"}`}>
                  <span className="abubble-who">{m.sender === "STAFF" ? "You" : m.sender === "SYSTEM" ? "System" : (convo.customer?.name ?? "Customer")}</span>
                  {m.audioUrl ? (
                    <audio controls src={assetUrl(m.audioUrl)} style={{ height: 36, maxWidth: 220, marginTop: 4 }} />
                  ) : (
                    <p>{m.body}</p>
                  )}
                  <span className="abubble-time">{new Date(m.createdAt).toLocaleString("en-IN")}</span>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </div>

          {error && <p className="form-error" style={{ marginBottom: 10 }}>{error}</p>}
          <div className="inline-form" style={{ width: "100%" }}>
            <input
              style={{ flex: 1 }}
              placeholder="Type a reply…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void reply(); } }}
            />
            <button className="btn primary" disabled={busy || !draft.trim()} onClick={reply}>Send reply</button>
          </div>
        </>
      )}
    </Shell>
  );
}
