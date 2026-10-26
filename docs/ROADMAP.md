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

## Phase 2 — Checkout + Payments ⬜
- Checkout flow, addresses
- **Razorpay** (cards, UPI, netbanking, wallets)
- GST handling, order creation, confirmation
- Customer accounts & order history

## Phase 3 — Business back office ⬜
The operational core the brand is run from.
- Inventory / stock control (per variant, per location)
- Customer management (CRM): profiles, history, segments
- Order management: statuses, picking/packing, refunds/returns

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
