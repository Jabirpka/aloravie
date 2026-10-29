"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ApiRequestError, resetPassword } from "@/lib/client";

function ResetInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push("/account"), 2500);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't reset your password.");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="auth-card">
        <h1 className="account-h">Reset your password</h1>
        <p className="form-error">This link is missing its reset code. Please use the link from your email, or request a new one.</p>
        <p style={{ marginTop: 16 }}><Link href="/forgot-password" className="btn primary">Request a new link</Link></p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="auth-card">
        <h1 className="account-h">Password updated</h1>
        <p className="muted">Your password has been changed. Taking you to sign in…</p>
        <p style={{ marginTop: 16 }}><Link href="/account" className="btn primary">Sign in now</Link></p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <p className="eyebrow">Account</p>
      <h1 className="account-h">Choose a new password</h1>
      <form className="auth-form" onSubmit={submit}>
        <label>
          <span>New password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
        </label>
        <label>
          <span>Confirm new password</span>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Set new password"}</button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <section className="container section narrow">
      <Suspense fallback={<p className="muted">Loading…</p>}>
        <ResetInner />
      </Suspense>
    </section>
  );
}
