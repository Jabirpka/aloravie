"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/components/AdminAuthProvider";
import { ApiRequestError, updateOwnName, changeOwnPassword } from "@/lib/api";

const DEPT_LABEL: Record<string, string> = {
  RETURNS: "Returns", PACKING: "Packing", CUSTOMER_CARE: "Customer care", OFFERS: "Offers", CRM: "CRM",
};

export default function ProfilePage() {
  const { user, loading, refresh } = useAuth();

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<string | null>(null);
  const [nameErr, setNameErr] = useState<string | null>(null);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    setNameErr(null);
    setNameMsg(null);
    try {
      await updateOwnName(name.trim());
      await refresh();
      setNameMsg("Saved.");
    } catch (err) {
      setNameErr(err instanceof ApiRequestError ? err.message : "Couldn't save your name.");
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setSavingPw(true);
    setPwErr(null);
    setPwMsg(null);
    try {
      await changeOwnPassword(current, next);
      setCurrent("");
      setNext("");
      setPwMsg("Password changed.");
    } catch (err) {
      setPwErr(err instanceof ApiRequestError ? err.message : "Couldn't change your password.");
    } finally {
      setSavingPw(false);
    }
  }

  if (loading || !user) return <Shell title="My profile"><p className="muted">Loading…</p></Shell>;

  return (
    <Shell title="My profile">
      <div className="two-col">
        <div className="card">
          <div className="card-head"><h2>Profile</h2></div>
          <form className="card-body" onSubmit={saveName}>
            <div className="field-grid">
              <label className="full"><span>Display name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
            </div>
            <dl style={{ margin: "14px 0 0" }}>
              <div className="kv"><dt>Email</dt><dd>{user.email}</dd></div>
              <div className="kv"><dt>Role</dt><dd>{user.role}</dd></div>
              <div className="kv"><dt>Departments</dt><dd>{user.departments.length ? user.departments.map((d) => DEPT_LABEL[d] ?? d).join(", ") : "All (owner/admin)"}</dd></div>
            </dl>
            {nameErr && <p className="form-error" style={{ marginTop: 10 }}>{nameErr}</p>}
            {nameMsg && <p className="muted" style={{ marginTop: 10 }}>{nameMsg}</p>}
            <button className="btn primary" type="submit" disabled={savingName} style={{ marginTop: 14 }}>{savingName ? "Saving…" : "Save name"}</button>
          </form>
        </div>

        <div className="card">
          <div className="card-head"><h2>Change password</h2></div>
          <form className="card-body" onSubmit={savePassword} style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6, fontSize: 13 }}><span className="muted">Current password</span>
              <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13 }}><span className="muted">New password</span>
              <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} autoComplete="new-password" />
            </label>
            {pwErr && <p className="form-error">{pwErr}</p>}
            {pwMsg && <p className="muted">{pwMsg}</p>}
            <button className="btn primary" type="submit" disabled={savingPw}>{savingPw ? "Saving…" : "Update password"}</button>
          </form>
        </div>
      </div>
    </Shell>
  );
}
