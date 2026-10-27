# Aloravie Commerce Platform

The commerce and operations platform for **Aloravie** — a women's clothing & accessories brand, midrange, launching in India. *Dressed up in first light.*

This is a monorepo for the web store, the mobile apps, the business back office, and the services that connect them to payments, couriers and marketplaces.

## Approach

**Hybrid**: we build and own the storefront, the admin/back office and the data. We integrate proven Indian services for the commodity, high-risk pieces rather than rebuilding them:

- **Payments / UPI** → Razorpay
- **Couriers / delivery** → Shiprocket / Delhivery
- **Customer chat** → a managed chat provider (TBD)
- **Marketplace sync** → Amazon.in, Flipkart, Myntra, Meesho (AJIO / Nykaa later)

## Layout

```
backend/    Node + TypeScript + Express + Prisma (PostgreSQL) API
web/        Storefront (Next.js) — the shop customers see          :3000
admin/      Back office (Next.js) — staff dashboard & operations    :3001
shared/     Cross-cutting assets shared by web, apps and admin (brand design tokens)
docs/       ROADMAP.md (phases) and ARCHITECTURE.md (decisions)
```

The Flutter mobile apps are added in a later phase (see `docs/ROADMAP.md`).

## Getting started (backend)

```bash
cd backend
cp .env.example .env     # then set DATABASE_URL + JWT secrets
npm install
npm run prisma:generate
npm run prisma:migrate   # needs a running PostgreSQL
npm run dev
```

The API boots on `http://localhost:4000`. `GET /health` works without a database; everything else needs the migrated DB.

## Getting started (web storefront)

```bash
cd web
cp .env.example .env.local   # points at http://localhost:4000 by default
npm install
npm run dev
```

The storefront runs on `http://localhost:3000`. It renders a sample catalogue until the backend DB is live.

## Getting started (admin / back office)

```bash
cd admin
cp .env.example .env.local   # points at http://localhost:4000
npm install
npm run dev
```

The back office runs on `http://localhost:3001`. Sign in with a staff account — the **first account** ever registered (via `POST /api/auth/register`) becomes the OWNER. It needs the backend + a migrated DB.

## Running the full stack (with checkout)

1. **Start PostgreSQL** (any instance; quickest is Docker):
   ```bash
   docker run -d --name aloravie-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=aloravie -p 5432:5432 postgres:16
   ```
2. **Migrate + seed** the backend:
   ```bash
   cd backend && npm run prisma:migrate && npm run db:seed
   ```
3. **Run both** apps (`backend` on :4000, `web` on :3000). `PAYMENT_MODE=mock` (the default) lets you complete checkout without a real gateway.
4. In the storefront: create an account → add to bag → checkout → the order confirms and appears under **My orders**.
5. In the **back office** (:3001): open the order → confirm it → **Book shipment** (mock courier issues an AWB) → **Sync tracking** to advance it → print the **Invoice / Delivery note / Label**. The storefront order page shows the live tracking timeline.

6. In the back office **Channels**: connect a marketplace (Amazon/Flipkart/Myntra/Meesho) → it lists your active catalogue → **Push stock** sends one shared pool → **Pull orders** imports marketplace orders into the same pipeline (in `MARKETPLACE_MODE=mock`, sample orders are generated so you can see it work).

For real payments set `PAYMENT_MODE=razorpay` and add `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (Razorpay test keys work end to end). For real couriers set `COURIER_MODE=shiprocket` with the `SHIPROCKET_*` vars, and fill in `SELLER_*` (name, GSTIN, address) for the printed documents. For real marketplace sync set `MARKETPLACE_MODE=live` and implement each channel's connector with its seller credentials — all in `backend/.env`.

## Conventions

- **Money is always integer minor units** (paise for INR) in a `*Minor` field, paired with a `currency` code. Never floats. See `backend/src/lib/money.ts`.
- Brand colours, type and tone live in `shared/brand/` and `memory` — every surface pulls from there.
