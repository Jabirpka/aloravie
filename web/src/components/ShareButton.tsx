"use client";

import { useState } from "react";
import { ShareIcon } from "./icons";

// Share a product. On HTTPS (secure context) this opens the native share sheet
// — WhatsApp, Instagram, Messages, etc. Over plain http the browser blocks that
// (and the clipboard API), so we fall back to a menu of direct share links plus
// a legacy copy that still works without a secure context.
export function ShareButton({ title, price, image }: { title: string; price?: string; image?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const label = price ? `${title} · ${price}` : title;

  async function onShare() {
    const url = window.location.href;
    const text = `${label} — Aloravie`;
    const secure = typeof navigator !== "undefined" && window.isSecureContext;

    // Best: attach the actual product photo so the image itself is shared
    // (not just a link). Requires a secure context (HTTPS).
    if (secure && image && typeof navigator.canShare === "function") {
      try {
        const res = await fetch(image);
        const blob = await res.blob();
        const file = new File([blob], "aloravie-product.jpg", { type: blob.type || "image/jpeg" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title, text, url, files: [file] });
          return;
        }
      } catch {
        /* fall through to a link share */
      }
    }
    // Next best: native link share (apps show the preview card).
    if (secure && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
      } catch {
        /* user cancelled */
      }
      return;
    }
    // Fallback menu (plain http / unsupported browsers).
    setOpen((o) => !o);
  }

  function markCopied() {
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    setOpen(false);
  }

  function legacyCopy(text: string) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      markCopied();
    } catch {
      setOpen(false);
    }
  }

  function copy() {
    const url = window.location.href;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(markCopied, () => legacyCopy(url));
    } else {
      legacyCopy(url);
    }
  }

  const url = typeof window !== "undefined" ? window.location.href : "";
  const t = encodeURIComponent(`${label} — Aloravie`);
  const u = encodeURIComponent(url);
  const links = [
    { name: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${label} — ${url}`)}` },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { name: "Telegram", href: `https://t.me/share/url?url=${u}&text=${t}` },
    { name: "X (Twitter)", href: `https://twitter.com/intent/tweet?text=${t}&url=${u}` },
    { name: "Email", href: `mailto:?subject=${t}&body=${encodeURIComponent(`${label}\n${url}`)}` },
  ];

  return (
    <div className="share-wrap">
      <button type="button" className="link-btn share-btn" onClick={onShare} aria-label="Share this product" title="Share">
        <ShareIcon />
      </button>
      {open && (
        <div className="share-menu" role="menu">
          {links.map((l) => (
            <a key={l.name} href={l.href} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
              {l.name}
            </a>
          ))}
          <button type="button" onClick={copy}>{copied ? "Copied!" : "Copy link"}</button>
        </div>
      )}
    </div>
  );
}
