# Aloravie Platform — Roadmap

Phased build. Each phase ships something usable; nothing is big-bang. Current approach is **hybrid** (see `ARCHITECTURE.md`).

Legend: ✅ done · 🚧 in progress · ⬜ not started

---

## Phase 0 — Foundation ✅
The base everything sits on.
- ✅ Monorepo layout, docs, `.gitignore`, git initialised
- ✅ Shared brand design tokens (`shared/brand/`)
- ✅ Backend: Node + TS + Express + Prisma (PostgreSQL), config, logging, error handling
- ✅ Core data model (users/staff, customers, catalog, inventory, orders, channels)
- ✅ Auth: staff register/login/refresh/me (JWT + rotating refresh tokens)
- ✅ Products vertical slice: list + detail + create
- ✅ Verified: typechecks clean, boots, `/health` 200, 404 + validation return consistent error shape
- Remaining to run live: a PostgreSQL database, then `prisma:migrate` + `db:seed`

## Phase 1 — Storefront + Catalog ✅ (core)
The shop customers see. Built as a Next.js (App Router, TS) app in `web/`, wired to the Phase 0 API with a bundled sample-catalog fallback.
- ✅ Web storefront app in the Aloravie brand (light + Evening dark mode)
- ✅ Home: hero, category strip, featured grid, "one system" band
- ✅ Product catalog + category filtering (`/shop`, `/shop?category=`)
- ✅ Product detail pages with variant (size) selection
- ✅ Cart: add to bag, quantity, remove, order summary, free-ship threshold (localStorage)
- ✅ Verified live: typechecks, production build clean, full add-to-bag → cart flow works, no console errors
- Remaining in later passes: free-text search, real product images/galleries, account-linked cart (needs Phase 2 auth for customers)

## Phase 2 — Checkout + Payments ✅ (core)
- ✅ Customer accounts: register/login/refresh/logout/me (separate from staff), addresses
- ✅ Checkout: cart → order with GST (5%/12% apparel slabs) + shipping, stock reserved on order
- ✅ Payments: **Razorpay** (UPI/cards/netbanking/wallets) + a dev **mock** mode; signature verification; inventory committed on payment
- ✅ Order creation, confirmation page, order history
- ✅ Verified: backend + web typecheck and build clean; routes enforce auth (401) and validation (400); `/payments/mode` works
- ⏳ Not yet run against a live DB here (no Postgres in this environment). To test the full flow: run Postgres, `prisma:migrate` + `db:seed`, start backend + web, register, add to bag, checkout (mock mode). Live Razorpay needs the brand's test/live keys.
- Later: GST invoice PDF (Phase 4), COD, saved-address picker in checkout UI

## Phase 3 — Business back office ✅ (core)
The operational core the brand is run from. Built as a separate staff admin app in `admin/` (Next.js, port 3001), with admin API under `/api/admin/*` (staff-auth only).
- ✅ Dashboard: revenue, orders, customers, product counts + status breakdown, recent orders, low stock
- ✅ Order management: list + filter by status, detail, status transitions (confirm → pack → ship → deliver; cancel/return) with stock release/restock
- ✅ Inventory / stock control: per variant × location, available = onHand − reserved, inline on-hand adjustment, low-stock view
- ✅ Customer management (CRM): searchable list with order count + lifetime spend, detail with orders & addresses
- ✅ Products: list all statuses, activate/archive
- ✅ Verified: backend + admin typecheck and build clean; `/api/admin/*` enforce staff auth (401); login UI renders
- ⏳ Not run against a live DB here (no Postgres). Later: staff user management UI, product create/edit forms, refunds, CSV export, segments

## Phase 4 — Fulfilment & delivery ⬜
- Courier integration (**Shiprocket / Delhivery**): rates, booking, pickup
- Order tracking (customer-facing timeline + notifications)
- **Invoice** generator (GST), **delivery note**, **shipping label / address** printing

## Phase 5 — Marketplace sync ⬜
One stock pool across all channels.
- Channel connectors: **Amazon.in**, **Flipkart**, **Myntra**, **Meesho** (then AJIO / Nykaa)
- Inventory push (avoid oversell), listing sync
- Marketplace order ingestion into the same order pipeline

## Phase 6 — Mobile apps ⬜
- Flutter apps for **Android + iOS** sharing the storefront experience
- Push notifications

## Phase 7 — Engagement ⬜
- Live chat / customer support
- Notifications: WhatsApp, email, SMS (order, shipping, marketing)
- **3D product catalogue** (interactive product views)

---

### Notes
- Phases can overlap once the foundation is stable, but 0→1→2 is the critical path to a first sale.
- Each external integration (Razorpay, Shiprocket, each marketplace) needs the brand's own seller/merchant credentials before it can go live.
