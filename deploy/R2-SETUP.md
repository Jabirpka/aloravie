# Cloudflare R2 image storage

By default the backend stores uploads (product images, return photos, support
voice notes) on local disk. On a VPS that works and persists, but the files then
live only on that one box. Switching to **Cloudflare R2** (S3-compatible object
storage) makes them durable and serves them from a CDN.

The code is already R2-ready — there is **nothing to change in the app**. R2 is
turned on entirely through environment variables. These steps are the parts only
you can do (they need your Cloudflare account).

## 1. Create a bucket

Cloudflare dashboard → **R2** → **Create bucket** → name it e.g. `aloravie-uploads`.

## 2. Make it publicly readable

The storefront loads images with a plain `<img>` tag, so the bucket needs public
read access. Either:

- **Quick start:** bucket → **Settings** → **Public access** → enable the **r2.dev**
  subdomain. You get a URL like `https://pub-<hash>.r2.dev`. (Rate-limited; fine to
  begin with.)
- **Production:** connect a **custom domain** (e.g. `cdn.aloravie.com`) under the
  bucket's Public access settings, and add the DNS record Cloudflare shows.

Whichever you pick is your **`STORAGE_PUBLIC_URL`** (no trailing slash).

> No R2 CORS config is needed — the browser only does simple `GET`s for images and
> audio, and uploads happen server-side from the API.

## 3. Create an API token

R2 → **Manage R2 API Tokens** → **Create API token** → permission **Object Read & Write**,
scoped to this bucket. Cloudflare shows three things — save them:

- **Access Key ID** → `S3_ACCESS_KEY_ID`
- **Secret Access Key** → `S3_SECRET_ACCESS_KEY`
- **S3 endpoint** `https://<account-id>.r2.cloudflarestorage.com` → `S3_ENDPOINT`

## 4. Set the backend env

In `backend/.env`:

```ini
STORAGE_DRIVER=s3
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=aloravie-uploads
S3_ACCESS_KEY_ID=<access key id>
S3_SECRET_ACCESS_KEY=<secret access key>
STORAGE_PUBLIC_URL=https://pub-<hash>.r2.dev
```

## 5. Verify it works

Restart the API, then run the built-in round-trip check:

```bash
cd backend && npm run check-storage
```

It uploads a tiny test object, reads it back through `STORAGE_PUBLIC_URL`, and
deletes it — printing exactly which step fails if something is misconfigured
(wrong credentials, bucket not public, wrong public URL). A clean run ends with
`R2 / S3 storage is correctly configured. ✅`.

## 6. (If you already had local uploads)

Copy anything already in `backend/uploads/` up to the bucket once, so old images
keep working after the switch — e.g. with `rclone` or the Cloudflare dashboard
uploader. New uploads go straight to R2.

---

**How it hangs together:** the API's multer layer writes to R2 instead of disk
(`backend/src/lib/uploads.ts`), `fileUrl()` returns `STORAGE_PUBLIC_URL/<key>`, and
the web/admin `assetUrl()` helpers pass those absolute URLs straight through to
`<img>` / `<audio>`. The backend refuses to boot if `STORAGE_DRIVER=s3` is set
without the full credential set (see `backend/src/env.ts`).
