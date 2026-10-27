"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import type { SupportConversation } from "@/lib/types";
import {
  assetUrl,
  getConversation,
  listConversations,
  sendMessage,
  sendVoice,
  startConversation,
} from "@/lib/client";

export function ChatWidget() {
  const { customer, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [convo, setConvo] = useState<SupportConversation | null>(null);
  const [draft, setDraft] = useState("");
  const [unread, setUnread] = useState(0);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const seenRef = useRef(0); // messages seen (for unread accounting)
  const openRef = useRef(open);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Pick up the latest open conversation once signed in.
  useEffect(() => {
    if (loading || !customer) return;
    listConversations()
      .then((list) => {
        const latest = list[0];
        if (latest) {
          setConvo(latest);
          seenRef.current = latest.messages.length;
        }
      })
      .catch(() => {});
  }, [customer, loading]);

  // Poll the active conversation; badge unread staff replies while closed.
  useEffect(() => {
    if (!customer || !convo) return;
    const t = window.setInterval(async () => {
      try {
        const updated = await getConversation(convo.id);
        setConvo(updated);
        if (!openRef.current) {
          const newStaff = updated.messages.slice(seenRef.current).filter((m) => m.sender !== "CUSTOMER").length;
          if (newStaff > 0) setUnread((u) => u + newStaff);
          seenRef.current = updated.messages.length;
        }
      } catch {
        /* ignore */
      }
    }, 5000);
    return () => window.clearInterval(t);
  }, [customer, convo?.id]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [convo?.messages.length, open]);

  const openPanel = useCallback(() => {
    setOpen(true);
    setUnread(0);
    if (convo) seenRef.current = convo.messages.length;
  }, [convo]);

  async function send() {
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const updated = convo
        ? await sendMessage(convo.id, draft.trim())
        : await startConversation("Support", draft.trim());
      setConvo(updated);
      seenRef.current = updated.messages.length;
      setDraft("");
    } catch {
      setError("Couldn't send. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleRecord() {
    if (!convo) {
      setError("Send a message first to start the conversation.");
      return;
    }
    if (recording) {
      recRef.current?.stop();
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size === 0) return;
        try {
          setBusy(true);
          const updated = await sendVoice(convo.id, blob);
          setConvo(updated);
          seenRef.current = updated.messages.length;
        } catch {
          setError("Couldn't send the voice note.");
        } finally {
          setBusy(false);
        }
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setError("Microphone access was blocked.");
    }
  }

  if (loading) return null;

  return (
    <>
      {!open && (
        <button className="chat-fab" onClick={openPanel} aria-label="Chat with support">
          Chat with us
          {unread > 0 && <span className="chat-unread" aria-label={`${unread} new replies`}>{unread}</span>}
        </button>
      )}

      {open && (
        <div className="chat-panel" role="dialog" aria-label="Support chat">
          <div className="chat-panel-head">
            <span className="strong">Aloravie support</span>
            <button className="chat-min" onClick={() => setOpen(false)} aria-label="Minimize chat">—</button>
          </div>

          {!customer ? (
            <div className="chat-body chat-signin">
              <p className="muted">Sign in to chat with our team and keep your history.</p>
              <Link href="/account?next=/support" className="btn primary" onClick={() => setOpen(false)}>Sign in</Link>
            </div>
          ) : (
            <>
              <div className="chat-body">
                {!convo || convo.messages.length === 0 ? (
                  <p className="muted chat-hint">How can we help? Ask about an order, a return, or sizing.</p>
                ) : (
                  convo.messages.map((m) => (
                    <div key={m.id} className={`cbubble ${m.sender === "CUSTOMER" ? "mine" : "theirs"}`}>
                      {m.sender === "STAFF" && <span className="cbubble-who">Aloravie</span>}
                      {m.audioUrl ? (
                        <audio controls src={assetUrl(m.audioUrl)} className="cbubble-audio" />
                      ) : (
                        <p>{m.body}</p>
                      )}
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>
              {error && <p className="chat-error">{error}</p>}
              <div className="chat-input">
                <button
                  className={`chat-mic ${recording ? "rec" : ""}`}
                  onClick={toggleRecord}
                  disabled={busy && !recording}
                  aria-label={recording ? "Stop recording" : "Record a voice note"}
                  title={recording ? "Stop & send" : "Record a voice note"}
                >
                  {recording ? "■" : "🎤"}
                </button>
                <input
                  placeholder={recording ? "Recording…" : "Type a message…"}
                  value={draft}
                  disabled={recording}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void send(); } }}
                />
                <button className="btn primary chat-send" onClick={send} disabled={busy || !draft.trim()}>Send</button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
