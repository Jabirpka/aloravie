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
backend/    Node + TypeScript + Express + Prisma (PostgreSQL) API and back office
shared/     Cross-cutting assets shared by web, apps and admin (brand design tokens)
docs/       ROADMAP.md (phases) and ARCHITECTURE.md (decisions)
```

The storefront web app and the Flutter mobile apps are added in later phases (see `docs/ROADMAP.md`).

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

## Conventions

- **Money is always integer minor units** (paise for INR) in a `*Minor` field, paired with a `currency` code. Never floats. See `backend/src/lib/money.ts`.
- Brand colours, type and tone live in `shared/brand/` and `memory` — every surface pulls from there.
