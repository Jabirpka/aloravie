"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import type { SupportConversation } from "@/lib/types";
import { ApiRequestError, getConversation, listConversations, sendMessage, startConversation } from "@/lib/client";

export default function SupportPage() {
  const { customer, loading } = useAuth();
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [active, setActive] = useState<SupportConversation | null>(null);
  const [draft, setDraft] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refreshList = useCallback(async () => {
    try {
      setConversations(await listConversations());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (loading || !customer) return;
    void refreshList();
  }, [loading, customer, refreshList]);

  // Poll the open conversation so staff replies appear without a refresh.
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(async () => {
      try {
        const updated = await getConversation(active.id);
        setActive(updated);
      } catch {
        /* ignore */
      }
    }, 5000);
    return () => window.clearInterval(id);
  }, [active?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages.length]);

  async function send() {
    if (!active || !draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await sendMessage(active.id, draft.trim());
      setActive(updated);
      setDraft("");
      void refreshList();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't send your message.");
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const convo = await startConversation(newSubject.trim(), draft.trim());
      setActive(convo);
      setDraft("");
      setNewSubject("");
      void refreshList();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't start the conversation.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <section className="container section"><p className="muted">Loading…</p></section>;

  if (!customer) {
    return (
      <section className="container section narrow">
        <p className="eyebrow">Support</p>
        <h1 className="checkout-h">We&rsquo;re here to help</h1>
        <p className="muted">Sign in to start a conversation with our team and keep your history.</p>
        <Link href="/account?next=/support" className="btn primary">Sign in</Link>
      </section>
    );
  }

  return (
    <section className="container section narrow">
      <p className="eyebrow">Support</p>
      <h1 className="checkout-h">{active ? active.subject : "How can we help?"}</h1>

      {!active ? (
        <>
          <div className="support-new">
            <input
              placeholder="Subject (optional)"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
            />
            <textarea
              placeholder="Tell us what you need — an order question, a return, sizing help…"
              rows={4}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            {error && <p className="form-error">{error}</p>}
            <button className="btn primary" disabled={busy || !draft.trim()} onClick={start}>
              {busy ? "Sending…" : "Start conversation"}
            </button>
          </div>

          {conversations.length > 0 && (
            <div className="support-list">
              <h2 className="support-list-h">Your conversations</h2>
              {conversations.map((c) => (
                <button key={c.id} className="support-row" onClick={() => setActive(c)}>
                  <span>{c.subject}</span>
                  <span className={`status-pill status-${c.status.toLowerCase()}`}>{c.status}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <button className="link-btn support-back" onClick={() => { setActive(null); void refreshList(); }}>← All conversations</button>
          <div className="chat">
            {active.messages.map((m) => (
              <div key={m.id} className={`bubble ${m.sender === "CUSTOMER" ? "mine" : "theirs"}`}>
                {m.sender === "STAFF" && <span className="bubble-who">Aloravie</span>}
                <p>{m.body}</p>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          {active.status === "CLOSED" && <p className="muted">This conversation was closed. Send a message to reopen it.</p>}
          {error && <p className="form-error">{error}</p>}
          <div className="chat-input">
            <input
              placeholder="Type a message…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            />
            <button className="btn primary" disabled={busy || !draft.trim()} onClick={send}>Send</button>
          </div>
        </>
      )}
    </section>
  );
}
