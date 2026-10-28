# Deployment config

Version-controlled config for the single-VPS deployment. The full step-by-step
runbook is in [`docs/DEPLOY.md`](../docs/DEPLOY.md); these files are what it
references.

| File | Purpose |
|------|---------|
| [`../ecosystem.config.js`](../ecosystem.config.js) | PM2 process config — runs the API (`:4000`), storefront (`:3000`) and admin (`:3001`). |
| [`nginx/ip-staging.conf`](nginx/ip-staging.conf) | **Profile A** — IP-first preview (no domain, no HTTPS): storefront on `:80`, admin on `:8081`, API under `/api`. |
| [`nginx/aloravie.conf`](nginx/aloravie.conf) | **Profile B** — storefront (apex + www) on your domain. |
| [`nginx/admin.aloravie.conf`](nginx/admin.aloravie.conf) | **Profile B** — admin back office on `admin.<domain>`. |
| [`nginx/api.aloravie.conf`](nginx/api.aloravie.conf) | **Profile B** — API on `api.<domain>` (incl. `client_max_body_size 15M` for uploads). |
| [`R2-SETUP.md`](R2-SETUP.md) | Optional — move image/upload storage to Cloudflare R2 (durable + CDN). Env-only; verify with `npm run check-storage`. |

## Two profiles

**Profile A — IP-first (staging / preview).** Run the system on the bare VPS IP to
demo it and test end-to-end before you buy a domain. ⚠️ This is **not a payment-ready
public launch**: a bare IP cannot get an HTTPS certificate, so it runs over plain HTTP,
and Razorpay live payments + KYC need HTTPS on a real domain. So keep payments in
**mock** mode here. Env for this profile:

- `backend/.env`: `NODE_ENV=development`, `PAYMENT_MODE=mock`, `STORAGE_DRIVER=local`,
  `CORS_ORIGINS=http://<IP>,http://<IP>:8081`.
- Build web + admin with `NEXT_PUBLIC_API_URL=http://<IP>`.

**Profile B — domain (production launch).** Point `aloravie.com`, `admin.`, `api.` at
the box, use the three per-domain Nginx files, run `certbot --nginx` for HTTPS, and set
`backend/.env` to `NODE_ENV=production` + `PAYMENT_MODE=razorpay` (+ keys +
`RAZORPAY_WEBHOOK_SECRET`) + strong JWT secrets + `CORS_ORIGINS=https://<domain>,https://admin.<domain>`.
Build web + admin with `NEXT_PUBLIC_API_URL=https://api.<domain>`. The backend refuses
to boot in production if any of these are unsafe (see `backend/src/env.ts`).

## Before you use these

1. **Set your domain.** The Nginx files use `aloravie.com` as a placeholder —
   replace it with your real domain in all three `nginx/*.conf` files, then run
   `certbot --nginx` per the headers in each file to add HTTPS.
2. **Build each app first.** PM2 runs built output:
   - `backend`: `npm ci && npm run build` → `dist/index.js` (reads `backend/.env`).
   - `web` / `admin`: Next.js bakes `NEXT_PUBLIC_API_URL` **at build time**, so set it
     before `next build`:
     `NEXT_PUBLIC_API_URL=https://api.<your-domain> npm ci && npm run build`.
3. **Production env.** `backend/.env` must set `NODE_ENV=production`,
   `PAYMENT_MODE=razorpay` (+ keys + `RAZORPAY_WEBHOOK_SECRET`), strong JWT secrets,
   and `CORS_ORIGINS` listing your storefront + admin URLs. The backend refuses to
   boot if any of these are unsafe (see `src/env.ts`). `STORAGE_DRIVER=local` is fine
   on a VPS (disk persists); set `s3` for R2/S3 image durability.

## Start

```bash
pm2 start ecosystem.config.js && pm2 save && pm2 startup
```
