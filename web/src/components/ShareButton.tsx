"use client";

import { useState } from "react";

// Share a product. On mobile this opens the native share sheet (WhatsApp,
// Instagram, Messages, …). On desktop it falls back to a small menu.
export function ShareButton({ title, price }: { title: string; price?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const label = price ? `${title} · ${price}` : title;

  async function onShare() {
    const url = window.location.href;
    const text = `${label} — Aloravie`;
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

  const waText = typeof window !== "undefined" ? `${label} — ${window.location.href}` : label;

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
