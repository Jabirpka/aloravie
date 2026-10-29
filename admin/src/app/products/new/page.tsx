"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/components/AdminAuthProvider";
import {
  ApiRequestError,
  assetUrl,
  createProduct,
  listCategories,
  uploadProductImages,
} from "@/lib/api";
import type { CategoryRow, ProductStatus } from "@/lib/types";

// Turn a title into a URL-safe slug ("First Light Dress" -> "first-light-dress").
function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface VariantRow {
  name: string;
  sku: string;
  price: string; // rupees, as typed
  stock: string;
}

const BLANK_VARIANT: VariantRow = { name: "", sku: "", price: "", stock: "" };

export default function NewProductPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<ProductStatus>("ACTIVE");
  const [images, setImages] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([{ name: "One size", sku: "", price: "", stock: "" }]);

  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await listCategories());
    } catch {
      /* categories are optional */
    }
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    void loadCategories();
  }, [user, loading, loadCategories]);

  // Keep slug in step with the title until the user edits the slug by hand.
  function onTitle(v: string) {
    setTitle(v);
    if (!slugEdited) setSlug(slugify(v));
  }

  function setVariant(i: number, patch: Partial<VariantRow>) {
    setVariants((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addVariant() {
    setVariants((rows) => [...rows, { ...BLANK_VARIANT }]);
  }
  function removeVariant(i: number) {
    setVariants((rows) => (rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows));
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      const urls = await uploadProductImages(files);
      setImages((prev) => [...prev, ...urls]);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't upload those images.");
    } finally {
      setUploading(false);
      e.target.value = ""; // allow re-selecting the same file
    }
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((u) => u !== url));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanSlug = slug || slugify(title);
    const preparedVariants = variants.map((v, i) => {
      const rupees = Number(v.price);
      return {
        name: v.name.trim() || "One size",
        sku: (v.sku.trim() || `${cleanSlug}-${i + 1}`).toUpperCase(),
        priceMinor: Math.round(rupees * 100),
        stock: v.stock ? Math.max(0, Math.round(Number(v.stock))) : 0,
      };
    });

    if (!title.trim()) return setError("Add a product name.");
    if (preparedVariants.some((v) => !Number.isFinite(v.priceMinor) || v.priceMinor <= 0)) {
      return setError("Every option needs a price greater than ₹0.");
    }

    setBusy(true);
    try {
      await createProduct({
        title: title.trim(),
        slug: cleanSlug,
        description: description.trim() || undefined,
        status,
        categoryId: categoryId || undefined,
        images: images.map((url) => ({ url })),
        variants: preparedVariants,
      });
      router.push("/products");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't save the product.");
      setBusy(false);
    }
  }

  return (
    <Shell title="Add product">
      <Link href="/products" className="back-link">← Products</Link>
      {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-head"><h2>Details</h2></div>
          <div className="card-body">
            <div className="field-grid">
              <label className="full"><span>Product name</span>
                <input value={title} onChange={(e) => onTitle(e.target.value)} required placeholder="First Light Linen Dress" />
              </label>
              <label className="full"><span>Web address (slug)</span>
                <input
                  value={slug}
                  onChange={(e) => { setSlug(slugify(e.target.value)); setSlugEdited(true); }}
                  placeholder="first-light-linen-dress"
                />
              </label>
              <label className="full"><span>Description</span>
                <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Fabric, fit, care — whatever helps a shopper decide." />
              </label>
              <label><span>Category</span>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label><span>Visibility</span>
                <select value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)}>
                  <option value="ACTIVE">Active (visible in store)</option>
                  <option value="DRAFT">Draft (hidden)</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Photos</h2></div>
          <div className="card-body">
            {images.length > 0 && (
              <div className="return-photos" style={{ marginBottom: 12 }}>
                {images.map((url) => (
                  <div key={url} style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={assetUrl(url)} alt="Product" />
                    <button
                      type="button"
                      className="btn sm danger"
                      style={{ position: "absolute", top: 4, right: 4 }}
                      onClick={() => removeImage(url)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="btn" style={{ cursor: "pointer" }}>
              {uploading ? "Uploading…" : "+ Add photos"}
              <input type="file" accept="image/*" multiple hidden onChange={onFiles} disabled={uploading} />
            </label>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>JPG or PNG, up to 5 MB each. The first photo is the main image.</p>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Options, price &amp; stock</h2></div>
          <div className="card-body">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Option (e.g. size)</th><th>Price (₹)</th><th className="num">Stock</th><th>SKU (optional)</th><th></th></tr>
                </thead>
                <tbody>
                  {variants.map((v, i) => (
                    <tr key={i}>
                      <td><input value={v.name} onChange={(e) => setVariant(i, { name: e.target.value })} placeholder="S / M / Free size" /></td>
                      <td><input type="number" min="0" step="1" value={v.price} onChange={(e) => setVariant(i, { price: e.target.value })} placeholder="2750" required /></td>
                      <td className="num"><input type="number" min="0" step="1" value={v.stock} onChange={(e) => setVariant(i, { stock: e.target.value })} placeholder="0" style={{ width: 80 }} /></td>
                      <td><input value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value })} placeholder="auto" /></td>
                      <td>
                        {variants.length > 1 && (
                          <button type="button" className="btn sm" onClick={() => removeVariant(i)}>Remove</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn" style={{ marginTop: 12 }} onClick={addVariant}>+ Add another option</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button className="btn primary" type="submit" disabled={busy || uploading}>
            {busy ? "Saving…" : "Save product"}
          </button>
          <Link href="/products" className="btn">Cancel</Link>
        </div>
      </form>
    </Shell>
  );
}
