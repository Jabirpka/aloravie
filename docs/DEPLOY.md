# Deploying Aloravie to a VPS (Ubuntu)

A step-by-step, copy-paste guide to run the whole platform on a single VPS — written for a
box like: **2 vCPU · 8 GB RAM · 100 GB NVMe · root access · India region**. That is comfortably
enough to run the database, API and both web apps with headroom.

Everything below assumes **Ubuntu 24.04 LTS**. Replace the placeholders:

- `SERVER_IP` → your VPS's dedicated IP
- `aloravie.com` → your real domain
- `deploy` → the Linux user we create (don't run the apps as root)

## 0. What you'll end up with

One server running four things behind Nginx:

| Part | Process | Internal port | Public URL |
|---|---|---|---|
| Storefront (Next.js) | pm2 `web` | 3000 | `https://aloravie.com` |
| Back office (Next.js) | pm2 `admin` | 3001 | `https://admin.aloravie.com` |
| API (Node/Express) | pm2 `api` | 4000 | `https://api.aloravie.com` |
| Database (PostgreSQL) | system service | 5432 | local only |

---

## Two phases — pick where you are

This runs in two profiles (both defined in `deploy/README.md`):

- **Phase 1 — IP preview (you are here).** Run it on the bare VPS IP over plain HTTP to demo
  and test end to end **before you have a domain**. Uses `deploy/nginx/ip-staging.conf`:
  storefront at `http://<IP>/`, admin at `http://<IP>:8081/`, API under `http://<IP>/api`.
  ⚠️ A bare IP **cannot get an HTTPS certificate**, and Razorpay live payments + KYC need
  HTTPS on a real domain — so **payments stay in mock mode** here. It's a preview, not a
  payment-ready launch.
- **Phase 2 — domain go-live (later).** Point a real domain at the box, use the three
  per-domain Nginx files, add HTTPS with certbot, and switch the backend to production +
  Razorpay.

**Sections 2–7 are identical for both phases.** Section 1 and sections 8–9 note where they
differ. Since you're on **Phase 1**, skip section 1 (DNS) for now.

## 1. Point your domain at the server (DNS) — *Phase 2 only*

> Skip this for the IP preview. Do it once you have a domain.

In your domain registrar's DNS settings, add **A records** → `SERVER_IP`:

| Type | Name | Value |
|---|---|---|
| A | `@` | `SERVER_IP` |
| A | `www` | `SERVER_IP` |
| A | `admin` | `SERVER_IP` |
| A | `api` | `SERVER_IP` |

DNS can take a few minutes to a few hours to propagate. Do this first so SSL works later.

---

## 2. First login & basic hardening

SSH in as root (your host emails you the password/key):

```bash
ssh root@SERVER_IP
```

Create a non-root user and give it sudo:

```bash
adduser deploy
usermod -aG sudo deploy
```

Enable a firewall. Port 8081 is the admin back office in the IP-preview phase:

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'        # 80 + 443
ufw allow 8081                # admin back office (Phase 1 / IP preview)
ufw --force enable
```

8 GB RAM doesn't need swap, but a small swap file is cheap insurance:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

From here on, work as `deploy`:

```bash
su - deploy
```

---

## 3. Install the stack

```bash
sudo apt update && sudo apt upgrade -y

# Node.js 20 LTS (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL, Nginx, git, build tools, certbot
sudo apt install -y postgresql postgresql-contrib nginx git build-essential
sudo apt install -y certbot python3-certbot-nginx

# PM2 (keeps the Node processes running + restarts on reboot)
sudo npm install -g pm2
```

Check versions: `node -v` (v20.x), `psql --version`, `nginx -v`.

---

## 4. Create the database

```bash
sudo -u postgres psql
```

Inside psql (pick a strong password):

```sql
CREATE DATABASE aloravie;
CREATE USER aloravie_app WITH ENCRYPTED PASSWORD 'a-strong-db-password';
GRANT ALL PRIVILEGES ON DATABASE aloravie TO aloravie_app;
\c aloravie
GRANT ALL ON SCHEMA public TO aloravie_app;
\q
```

Your `DATABASE_URL` will be:
`postgresql://aloravie_app:a-strong-db-password@localhost:5432/aloravie?schema=public`

---

## 5. Get the code & configure environment

```bash
cd ~
git clone <your-repo-url> aloravie
cd aloravie
```

> No remote yet? Push the repo to GitHub/GitLab first, or copy it up with `scp`/`rsync`.

### Backend env (`backend/.env`)

```bash
cp backend/.env.example backend/.env
# generate two strong secrets:
echo "ACCESS:  $(openssl rand -hex 32)"
echo "REFRESH: $(openssl rand -hex 32)"
nano backend/.env
```

**Phase 1 (IP preview):** use the staging values instead of the production block below —
`NODE_ENV=development`, `PAYMENT_MODE=mock`, `STORAGE_DRIVER=local`,
`CORS_ORIGINS=http://SERVER_IP,http://SERVER_IP:8081`, and leave the Razorpay keys blank.
Everything still works except real payments (checkout uses the mock flow).

**Phase 2 (domain launch):** set these:

```ini
NODE_ENV=production
PORT=4000
DATABASE_URL="postgresql://aloravie_app:a-strong-db-password@localhost:5432/aloravie?schema=public"
JWT_ACCESS_SECRET="<paste the ACCESS value>"
JWT_REFRESH_SECRET="<paste the REFRESH value>"
CORS_ORIGINS="https://aloravie.com,https://www.aloravie.com,https://admin.aloravie.com"

# Payments — go live with Razorpay (keys from the Razorpay dashboard)
PAYMENT_MODE=razorpay
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx

# Seller identity (printed on invoices / delivery notes / labels)
SELLER_NAME=Aloravie
SELLER_GSTIN=<your GSTIN>
SELLER_ADDRESS="<your business address>"
SELLER_STATE=Karnataka
SELLER_EMAIL=care@aloravie.com
SELLER_PHONE=<your phone>

# Turn these to live when you've added each provider's credentials:
# COURIER_MODE=shiprocket  (+ SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD)
# NOTIFY_MODE=live         (+ SENDGRID / TWILIO keys)
# MARKETPLACE_MODE=live
# STORAGE_DRIVER=s3        (recommended — see note below)
```

> **Product images / uploads.** On a VPS, `STORAGE_DRIVER=local` works and *persists* (unlike a PaaS). But images then live only on this disk, so include `backend/uploads` in your backups, or use `STORAGE_DRIVER=s3` with Cloudflare R2 for durability + a CDN. Start with `local`; move to R2 before you have many product photos.

### Web + admin env

These are **build-time** values (Next inlines `NEXT_PUBLIC_*`), so they must be set *before* you build.

```bash
# Phase 1 (IP preview) — point at the bare IP (API is served under /api on the same host):
echo 'NEXT_PUBLIC_API_URL=http://SERVER_IP' > web/.env.local
echo 'NEXT_PUBLIC_API_URL=http://SERVER_IP' > admin/.env.local

# Phase 2 (domain) — use the API hostname instead:
#   echo 'NEXT_PUBLIC_API_URL=https://api.aloravie.com' > web/.env.local
#   echo 'NEXT_PUBLIC_API_URL=https://api.aloravie.com' > admin/.env.local
```

---

## 6. Install, migrate, seed & build

```bash
# Backend
cd ~/aloravie/backend
npm ci
npx prisma generate
npx prisma migrate deploy   # applies the committed migrations (init, audit, returns, wishlist…)
npm run db:seed             # locations, channels, categories, sample products
npm run build          # compiles TypeScript to dist/

# Storefront
cd ~/aloravie/web && npm ci && npm run build

# Back office
cd ~/aloravie/admin && npm ci && npm run build
```

---

## 7. Run everything with PM2

The repo already ships a PM2 config at **`ecosystem.config.js`** (repo root) — no need to
write one. It defines the three apps `aloravie-api` (:4000), `aloravie-web` (:3000) and
`aloravie-admin` (:3001), each with a memory-restart guard.

Start and persist across reboots:

```bash
cd ~/aloravie
pm2 start ecosystem.config.js
pm2 save
pm2 startup        # run the one-line command it prints (sets up the boot service)
pm2 status         # aloravie-api / -web / -admin should all be "online"
```

---

## 8. Nginx reverse proxy

### Phase 1 — IP preview

One file does it all: `deploy/nginx/ip-staging.conf` — storefront on `:80` with the API under
`/api`, admin on `:8081`, and `server_name _` so it matches the bare IP (nothing to edit).

```bash
# from ~/aloravie
sudo cp deploy/nginx/ip-staging.conf /etc/nginx/sites-available/
sudo rm -f /etc/nginx/sites-enabled/default        # drop Ubuntu's default page
sudo ln -s /etc/nginx/sites-available/ip-staging.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Reachable at: storefront `http://SERVER_IP/` · admin `http://SERVER_IP:8081/` · API `http://SERVER_IP/api`.
**Skip section 9** (no HTTPS on a bare IP) and go to section 10.

### Phase 2 — domain

The repo ships one block per hostname in `deploy/nginx/`. Copy them in, swap the placeholder
domain, then enable:

```bash
# from ~/aloravie
sudo cp deploy/nginx/aloravie.conf       /etc/nginx/sites-available/
sudo cp deploy/nginx/admin.aloravie.conf /etc/nginx/sites-available/
sudo cp deploy/nginx/api.aloravie.conf   /etc/nginx/sites-available/

# replace the aloravie.com placeholder with your real domain in all three files:
sudo sed -i 's/aloravie\.com/YOURDOMAIN.com/g' \
  /etc/nginx/sites-available/aloravie.conf \
  /etc/nginx/sites-available/admin.aloravie.conf \
  /etc/nginx/sites-available/api.aloravie.conf

# enable + reload
sudo ln -s /etc/nginx/sites-available/aloravie.conf       /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/admin.aloravie.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/api.aloravie.conf   /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

The `api` block already sets `client_max_body_size 15M` for image / return-photo / voice-note
uploads and sets the proxy headers inline (no `proxy_params` include needed).

---

## 9. Turn on HTTPS (free, auto-renewing) — *Phase 2 only*

> Not applicable to the IP preview — a bare IP can't get a certificate. Do this once your
> domain's DNS points at the box (section 1).

```bash
sudo certbot --nginx -d aloravie.com -d www.aloravie.com -d admin.aloravie.com -d api.aloravie.com
```

Certbot rewrites the Nginx configs for SSL and sets up auto-renewal. Your sites are now on `https://`.

---

## 10. Create your first staff account (OWNER)

The **first** account registered becomes the OWNER:

```bash
curl -X POST https://api.aloravie.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Your Name","email":"you@aloravie.com","password":"a-strong-password"}'
```

Then sign in at `https://admin.aloravie.com`.

---

## 11. Daily database backup (important)

RAID protects against a disk failing — it is **not** a backup. Add a nightly dump:

```bash
mkdir -p ~/backups
nano ~/backup-db.sh
```

```bash
#!/usr/bin/env bash
set -e
STAMP=$(date +%F)
pg_dump "postgresql://aloravie_app:a-strong-db-password@localhost:5432/aloravie" \
  | gzip > "$HOME/backups/aloravie-$STAMP.sql.gz"
# keep 14 days
find "$HOME/backups" -name 'aloravie-*.sql.gz' -mtime +14 -delete
```

```bash
chmod +x ~/backup-db.sh
crontab -e
# add this line — runs at 2:30am daily:
30 2 * * * /home/deploy/backup-db.sh
```

> Even better: copy the dumps off the server (to Cloudflare R2 / S3 / Google Drive) so a total server loss doesn't take the backups with it. Restore with: `gunzip -c file.sql.gz | psql <DATABASE_URL>`.

---

## 12. Updating / redeploying later

```bash
cd ~/aloravie
git pull

cd backend && npm ci && npx prisma migrate deploy && npm run build
cd ../web   && npm ci && npm run build
cd ../admin && npm ci && npm run build

cd ~/aloravie && pm2 reload ecosystem.config.js
```

---

## 13. Before you call it "live" — checklist

These are for **Phase 2 (domain launch)**. In Phase 1 (IP preview) payments stay in mock mode
and there's no HTTPS — that's expected, not a gap.

- [ ] `PAYMENT_MODE=razorpay` with **live** keys, and the Razorpay webhook configured (URL `https://api.aloravie.com/...`, secret in `RAZORPAY_WEBHOOK_SECRET`)
- [ ] `SELLER_GSTIN` and real seller address set (they print on invoices)
- [ ] HTTPS working on all four hostnames
- [ ] A daily backup has actually produced a file in `~/backups`
- [ ] Changed the default DB password; `.env` files are not in git
- [ ] `COURIER_MODE`, `NOTIFY_MODE`, `MARKETPLACE_MODE` switched to live only once each provider's credentials are in `.env`
- [ ] **Next.js upgraded to 16** before public launch (tracked in `ARCHITECTURE.md`) — a security item, separate from this guide

---

### Rough running cost
VPS ~$6–9/month · domain ~$10–15/year · Razorpay ~2%/transaction · email/SMS/WhatsApp a few dollars as used.
