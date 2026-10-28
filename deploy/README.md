# Deployment config

Version-controlled config for the single-VPS deployment. The full step-by-step
runbook is in [`docs/DEPLOY.md`](../docs/DEPLOY.md); these files are what it
references.

| File | Purpose |
|------|---------|
| [`../ecosystem.config.js`](../ecosystem.config.js) | PM2 process config — runs the API (`:4000`), storefront (`:3000`) and admin (`:3001`). |
| [`nginx/aloravie.conf`](nginx/aloravie.conf) | Nginx reverse proxy for the storefront (apex + www). |
| [`nginx/admin.aloravie.conf`](nginx/admin.aloravie.conf) | Nginx reverse proxy for the admin back office. |
| [`nginx/api.aloravie.conf`](nginx/api.aloravie.conf) | Nginx reverse proxy for the API (incl. `client_max_body_size 15M` for uploads). |

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
