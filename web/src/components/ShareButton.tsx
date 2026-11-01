"use client";

import { useState } from "react";

// Share a product. On mobile this opens the native share sheet (WhatsApp,
// Instagram, Messages, …). On desktop it falls back to a small menu.
export function ShareButton({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const url = window.location.href;
    const text = `${title} — Aloravie`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        /* user cancelled — nothing to do */
      }
      return;
    }
    setOpen((o) => !o);
  }

  function copy() {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  const waText = typeof window !== "undefined" ? `${title} — ${window.location.href}` : title;

  return (
    <div className="share-wrap">
      <button type="button" className="link-btn share-btn" onClick={onShare} aria-label="Share this product">
        ↗ Share
      </button>
      {open && (
        <div className="share-menu" role="menu">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(waText)}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
          >
            WhatsApp
          </a>
          <button type="button" onClick={copy}>{copied ? "Copied!" : "Copy link"}</button>
        </div>
      )}
    </div>
  );
}
