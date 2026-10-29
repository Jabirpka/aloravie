"use client";

import Link from "next/link";
import { useState } from "react";
import { forgotPassword } from "@/lib/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await forgotPassword(email);
    } catch {
      /* we show the same message either way, so nothing to surface */
    } finally {
      setBusy(false);
      setSent(true);
    }
  }

  return (
    <section className="container section narrow">
      <div className="auth-card">
        <p className="eyebrow">Account</p>
        <h1 className="account-h">Reset your password</h1>
        {sent ? (
          <>
            <p className="muted">
              If an account exists for <strong>{email}</strong>, we&rsquo;ve sent a link to reset your password.
              Check your inbox (and spam folder). The link expires in 1 hour.
            </p>
            <p style={{ marginTop: 16 }}><Link href="/account" className="btn primary">Back to sign in</Link></p>
          </>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            <p className="muted" style={{ marginBottom: 6 }}>Enter your email and we&rsquo;ll send you a reset link.</p>
            <label>
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </label>
            <button className="btn primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
            <p style={{ marginTop: 12, textAlign: "center", fontSize: 14 }}>
              <Link href="/account">Back to sign in</Link>
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
