"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ApiRequestError, changePassword } from "@/lib/client";

function AccountInner() {
  const { customer, loading, login, register, logout } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/account";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
      } else {
        await register({
          email: form.email,
          password: form.password,
          name: form.name,
          phone: form.phone || undefined,
        });
      }
      router.push(next);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;

  if (customer) {
    return (
      <div className="account-card">
        {customer.mustChangePassword && (
          <p className="form-error" style={{ background: "var(--surface, #fff6f1)", padding: "10px 12px", borderRadius: 6, marginBottom: 14 }}>
            You&rsquo;re using a temporary password. Please set a new one below.
          </p>
        )}
        <p className="eyebrow">Your account</p>
        <h1 className="account-h">Hello{customer.name ? `, ${customer.name.split(" ")[0]}` : ""}.</h1>
        <dl className="account-details">
          <div><dt>Email</dt><dd>{customer.email ?? "—"}</dd></div>
          {customer.phone && <div><dt>Phone</dt><dd>{customer.phone}</dd></div>}
        </dl>
        <div className="account-actions">
          <Link href="/account/orders" className="btn primary">My orders</Link>
          <Link href="/account/wishlist" className="btn ghost">Wishlist</Link>
          <Link href="/account/addresses" className="btn ghost">Addresses</Link>
          <Link href="/account/returns" className="btn ghost">Returns</Link>
          <button className="btn ghost" onClick={() => logout()}>Sign out</button>
        </div>
        <ChangePassword startOpen={customer.mustChangePassword} />
      </div>
    );
  }

  return (
    <div className="auth-card">
      <div className="auth-tabs">
        <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button>
        <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Create account</button>
      </div>

      <form className="auth-form" onSubmit={submit}>
        {mode === "register" && (
          <label>
            <span>Name</span>
            <input value={form.name} onChange={(e) => update("name", e.target.value)} required autoComplete="name" />
          </label>
        )}
        <label>
          <span>Email</span>
          <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required autoComplete="email" />
        </label>
        {mode === "register" && (
          <label>
            <span>Phone (optional)</span>
            <input value={form.phone} onChange={(e) => update("phone", e.target.value)} autoComplete="tel" />
          </label>
        )}
        <label>
          <span>Password</span>
          <input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>

      {mode === "login" && (
        <p style={{ marginTop: 14, textAlign: "center", fontSize: 14 }}>
          <Link href="/forgot-password">Forgot your password?</Link>
        </p>
      )}
    </div>
  );
}

function ChangePassword({ startOpen }: { startOpen: boolean }) {
  const { refresh } = useAuth();
  const [open, setOpen] = useState(startOpen);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await changePassword(current, next);
      setDone(true);
      setCurrent("");
      setNext("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't change your password.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <p style={{ marginTop: 18 }}>
        <button type="button" className="link-btn" onClick={() => setOpen(true)}>Change password</button>
      </p>
    );
  }

  return (
    <form className="auth-form" onSubmit={submit} style={{ marginTop: 20, borderTop: "1px solid var(--line)", paddingTop: 18 }}>
      <h2 className="checkout-sub" style={{ marginTop: 0 }}>Change password</h2>
      {done && <p className="muted">Your password has been updated.</p>}
      <label>
        <span>Current password</span>
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
      </label>
      <label>
        <span>New password</span>
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} autoComplete="new-password" />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button className="btn primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Update password"}</button>
    </form>
  );
}

export default function AccountPage() {
  return (
    <section className="container section narrow">
      <Suspense fallback={<p className="muted">Loading…</p>}>
        <AccountInner />
      </Suspense>
    </section>
  );
}
