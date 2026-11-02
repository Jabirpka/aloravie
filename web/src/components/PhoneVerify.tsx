"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { ApiRequestError, requestPhoneOtp, verifyPhoneOtp } from "@/lib/client";

/**
 * Phone verification: enter a number → receive a one-time code → verify it.
 * In test mode (OTP_MODE=test) the backend returns the code, shown as a hint.
 */
export function PhoneVerify({ onVerified }: { onVerified?: () => void }) {
  const { customer, refresh } = useAuth();
  const [phone, setPhone] = useState(customer?.phone ?? "+91");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await requestPhoneOtp(phone.trim());
      setDevCode(r.devCode ?? null);
      setStage("code");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't send a code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await verifyPhoneOtp(phone.trim(), code.trim());
      await refresh();
      onVerified?.();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't verify the code.");
    } finally {
      setBusy(false);
    }
  }

  if (stage === "phone") {
    return (
      <form className="auth-form" onSubmit={sendCode}>
        <label>
          <span>Mobile number</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            autoComplete="tel"
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? "Sending…" : "Send code"}
        </button>
      </form>
    );
  }

  return (
    <form className="auth-form" onSubmit={verify}>
      <p className="muted" style={{ marginTop: 0 }}>
        Enter the 6-digit code sent to {phone}.{" "}
        <button type="button" className="link-btn" style={{ textTransform: "none" }} onClick={() => setStage("phone")}>
          Change number
        </button>
      </p>
      {devCode && (
        <p className="muted" style={{ background: "var(--surface)", padding: "8px 12px", borderRadius: 6 }}>
          Test mode — your code is <strong>{devCode}</strong> (real SMS isn&rsquo;t sent yet).
        </p>
      )}
      <label>
        <span>Verification code</span>
        <input
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="123456"
          required
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button className="btn primary" type="submit" disabled={busy}>
        {busy ? "Verifying…" : "Verify phone"}
      </button>
      <button type="button" className="link-btn" style={{ textTransform: "none", marginTop: 4 }} onClick={sendCode} disabled={busy}>
        Resend code
      </button>
    </form>
  );
}
