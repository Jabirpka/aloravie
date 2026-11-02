"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GOOGLE_CLIENT_ID, ApiRequestError } from "@/lib/client";
import { useAuth } from "./AuthProvider";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (opts: { client_id: string; callback: (r: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
        };
      };
    };
  }
}

// Load Google Identity Services once, shared across mounts.
let gisPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Google sign-in"));
    document.head.appendChild(s);
  });
  return gisPromise;
}

export function GoogleSignInButton({ onSuccess }: { onSuccess?: () => void }) {
  const { loginWithGoogle } = useAuth();
  const holder = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  // (Re)draw the button at the container's current width so it matches the form
  // and resizes cleanly. GIS caps the width at 400px.
  const draw = useCallback(() => {
    if (!holder.current || !window.google) return;
    const width = Math.min(400, Math.max(220, Math.floor(holder.current.clientWidth || 320)));
    holder.current.innerHTML = "";
    window.google.accounts.id.renderButton(holder.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "pill",
      locale: "en",
      width,
    });
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };
    loadGis()
      .then(() => {
        if (cancelled || !holder.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (resp) => {
            setError(null);
            try {
              await loginWithGoogle(resp.credential);
              onSuccessRef.current?.();
            } catch (err) {
              setError(err instanceof ApiRequestError ? err.message : "Google sign-in failed. Please try again.");
            }
          },
        });
        draw();
        window.addEventListener("resize", onResize);
      })
      .catch(() => setError("Could not load Google sign-in."));
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [loginWithGoogle, draw]);

  // When no client ID is configured, render nothing (email/password still works).
  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div className="google-signin">
      <div ref={holder} className="google-btn-holder" />
      {error && <p className="form-error" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}
