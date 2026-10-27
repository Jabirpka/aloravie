"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/components/AdminAuthProvider";
import { ApiRequestError, createEmployee, listEmployees, updateEmployee } from "@/lib/api";
import { ALL_DEPARTMENTS, DEPARTMENT_LABELS, canAccess } from "@/lib/access";
import type { Department, Employee } from "@/lib/types";

const ROLES: Employee["role"][] = ["STAFF", "ADMIN", "OWNER"];

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<Employee[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error" | "denied">("loading");
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await listEmployees());
      setState("ready");
    } catch (e) {
      setState(e instanceof ApiRequestError && e.status === 403 ? "denied" : "error");
    }
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    if (!canAccess(user, "employees")) {
      setState("denied");
      return;
    }
    void load();
  }, [user, loading, load]);

  return (
    <Shell title="Settings · Employees">
      <p className="muted" style={{ marginBottom: 16, maxWidth: "70ch" }}>
        Add staff, set each person&rsquo;s role, and choose the departments they can access. Owners and
        admins see everything; staff only see the areas their departments unlock.
      </p>
      {note && <p style={{ color: "var(--ok)", marginBottom: 12 }}>{note}</p>}
      {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}

      {state === "denied" && <div className="empty">Only owners and admins can manage employees.</div>}
      {state === "loading" && <div className="empty">Loading…</div>}
      {state === "error" && <div className="empty">Couldn&rsquo;t load employees.</div>}

      {state === "ready" && (
        <>
          <AddEmployee onDone={(m) => { setNote(m); void load(); }} onError={setError} />

          <div className="card">
            <div className="card-head"><h2>Team ({rows.length})</h2></div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Departments</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {rows.map((e) =>
                    editing === e.id ? (
                      <EditRow
                        key={e.id}
                        employee={e}
                        onCancel={() => setEditing(null)}
                        onSaved={(m) => { setEditing(null); setNote(m); void load(); }}
                        onError={setError}
                      />
                    ) : (
                      <tr key={e.id}>
                        <td className="strong">{e.name}</td>
                        <td className="muted">{e.email}</td>
                        <td>{e.role}</td>
                        <td>{e.role === "OWNER" || e.role === "ADMIN" ? <span className="muted">All areas</span> : e.departments.length ? e.departments.map((d) => DEPARTMENT_LABELS[d]).join(", ") : <span className="muted">None yet</span>}</td>
                        <td><span className={`pill ${e.isActive ? "ok" : "cancelled"}`}>{e.isActive ? "Active" : "Disabled"}</span></td>
                        <td><button className="btn sm" onClick={() => { setError(null); setEditing(e.id); }}>Edit</button></td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}

function DeptChecks({ value, onChange }: { value: Department[]; onChange: (d: Department[]) => void }) {
  function toggle(d: Department) {
    onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]);
  }
  return (
    <div className="dept-grid">
      {ALL_DEPARTMENTS.map((d) => (
        <label key={d} className="dept-check">
          <input type="checkbox" checked={value.includes(d)} onChange={() => toggle(d)} />
          <span>{DEPARTMENT_LABELS[d]}</span>
        </label>
      ))}
    </div>
  );
}

function AddEmployee({ onDone, onError }: { onDone: (msg: string) => void; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "STAFF" as Employee["role"] });
  const [depts, setDepts] = useState<Department[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    onError("");
    try {
      await createEmployee({ ...form, departments: form.role === "STAFF" ? depts : [] });
      setForm({ name: "", email: "", password: "", role: "STAFF" });
      setDepts([]);
      setOpen(false);
      onDone(`Added ${form.name}.`);
    } catch (err) {
      onError(err instanceof ApiRequestError ? err.message : "Couldn't add the employee.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return <button className="btn primary" style={{ marginBottom: 20 }} onClick={() => setOpen(true)}>+ Add employee</button>;
  }

  return (
    <div className="card">
      <div className="card-head"><h2>Add employee</h2></div>
      <form className="card-body" onSubmit={submit}>
        <div className="field-grid">
          <label className="full"><span>Name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label><span>Email</span><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
          <label><span>Temporary password</span><input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required /></label>
          <label><span>Role</span>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Employee["role"] })}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        </div>
        {form.role === "STAFF" && (
          <div style={{ marginTop: 12 }}>
            <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Departments</div>
            <DeptChecks value={depts} onChange={setDepts} />
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className="btn primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Create"}</button>
          <button className="btn" type="button" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

function EditRow({ employee, onCancel, onSaved, onError }: {
  employee: Employee;
  onCancel: () => void;
  onSaved: (msg: string) => void;
  onError: (m: string) => void;
}) {
  const [role, setRole] = useState(employee.role);
  const [depts, setDepts] = useState<Department[]>(employee.departments);
  const [isActive, setActive] = useState(employee.isActive);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    onError("");
    try {
      await updateEmployee(employee.id, { role, departments: role === "STAFF" ? depts : [], isActive });
      onSaved(`Updated ${employee.name}.`);
    } catch (err) {
      onError(err instanceof ApiRequestError ? err.message : "Couldn't save changes.");
      setBusy(false);
    }
  }

  return (
    <tr>
      <td className="strong">{employee.name}</td>
      <td className="muted">{employee.email}</td>
      <td>
        <select value={role} onChange={(e) => setRole(e.target.value as Employee["role"])}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </td>
      <td>{role === "STAFF" ? <DeptChecks value={depts} onChange={setDepts} /> : <span className="muted">All areas</span>}</td>
      <td>
        <label className="dept-check"><input type="checkbox" checked={isActive} onChange={(e) => setActive(e.target.checked)} /><span>Active</span></label>
      </td>
      <td>
        <div className="status-actions">
          <button className="btn sm primary" disabled={busy} onClick={save}>{busy ? "…" : "Save"}</button>
          <button className="btn sm" disabled={busy} onClick={onCancel}>Cancel</button>
        </div>
      </td>
    </tr>
  );
}
