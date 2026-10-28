"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/components/AdminAuthProvider";
import { ApiRequestError, createCategory, deleteCategory, listCategories, updateCategory } from "@/lib/api";
import type { CategoryRow } from "@/lib/types";

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function CategoriesPage() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await listCategories());
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    void load();
  }, [user, loading, load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createCategory({ name, slug: slug || slugify(name), parentId: parentId || null });
      setName(""); setSlug(""); setParentId("");
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't create the category.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: string) {
    try {
      await updateCategory(id, { name: editName });
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't rename.");
    }
  }

  async function remove(c: CategoryRow) {
    try {
      await deleteCategory(c.id);
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't delete.");
    }
  }

  return (
    <Shell title="Categories">
      {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}
      <div className="card">
        <div className="card-head"><h2>Add category</h2></div>
        <form className="card-body" onSubmit={add}>
          <div className="field-grid">
            <label><span>Name</span><input value={name} onChange={(e) => { setName(e.target.value); setSlug(slugify(e.target.value)); }} required /></label>
            <label><span>Slug</span><input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="auto" /></label>
            <label><span>Parent (optional)</span>
              <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
                <option value="">None (top level)</option>
                {rows.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <button className="btn primary" type="submit" disabled={busy} style={{ marginTop: 12 }}>{busy ? "Saving…" : "Add category"}</button>
        </form>
      </div>

      <div className="card">
        <div className="table-wrap">
          {state === "loading" && <div className="empty">Loading…</div>}
          {state === "error" && <div className="empty">Couldn&rsquo;t load categories.</div>}
          {state === "ready" &&
            (rows.length === 0 ? (
              <div className="empty">No categories yet.</div>
            ) : (
              <table className="table">
                <thead><tr><th>Name</th><th>Slug</th><th>Parent</th><th className="num">Products</th><th></th></tr></thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <td className="strong">
                        {editing === c.id ? (
                          <span className="inline-form">
                            <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                            <button className="btn sm primary" onClick={() => saveEdit(c.id)}>Save</button>
                            <button className="btn sm" onClick={() => setEditing(null)}>Cancel</button>
                          </span>
                        ) : c.name}
                      </td>
                      <td className="muted">{c.slug}</td>
                      <td>{c.parent?.name ?? "—"}</td>
                      <td className="num">{c._count.products}</td>
                      <td>
                        {editing !== c.id && (
                          <div className="status-actions">
                            <button className="btn sm" onClick={() => { setEditing(c.id); setEditName(c.name); }}>Rename</button>
                            <button className="btn sm danger" onClick={() => remove(c)}>Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
        </div>
      </div>
    </Shell>
  );
}
