"use client";

import { useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
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
        window.google.accounts.id.renderButton(holder.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          width: 280,
          locale: "en",
        });
      })
      .catch(() => setError("Could not load Google sign-in."));
    return () => {
      cancelled = true;
    };
  }, [loginWithGoogle]);

  // When no client ID is configured, render nothing (email/password still works).
  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div className="google-signin">
      <div ref={holder} style={{ display: "flex", justifyContent: "center" }} />
      {error && <p className="form-error" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}
