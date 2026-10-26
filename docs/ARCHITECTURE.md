# Aloravie Platform — Architecture & Decisions

A living record of the technical decisions and why we made them.

## Build approach: hybrid

We own the differentiating surfaces (storefront, admin/back office, data model, order pipeline) and integrate managed services for the commodity, high-risk pieces. This gets Aloravie to a real first sale quickly without a platform rebuild, while keeping control of the experience and the data.

| Concern | Decision | Why |
|---|---|---|
| Storefront & apps | **Custom** (web + Flutter) | The brand experience is the point; we want full control and no per-sale platform fee. |
| Back office / admin | **Custom** | Stock, orders, fulfilment and marketplace sync are the operational core — no off-the-shelf tool fits all of it. |
| Payments / UPI | **Razorpay** | India-first, UPI + cards + netbanking + wallets, PCI burden handled by them. |
| Couriers | **Shiprocket / Delhivery** | Aggregated rates, pickup scheduling, tracking, label generation. |
| Customer chat | Managed provider (TBD) | Faster and more reliable than building real-time chat ourselves. |
| Marketplaces | Connectors to **Amazon.in, Flipkart, Myntra, Meesho** | Sell where customers already are; sync one stock pool. |

## Stack

- **Backend**: Node.js + TypeScript + Express, Prisma ORM over **PostgreSQL**.
- **Auth**: JWT access tokens (short-lived) + rotating refresh tokens stored server-side. Passwords hashed with bcrypt.
- **Validation**: Zod at the edge of every route.
- **Logging**: pino (structured).
- **Frontend (web)**: TBD framework in Phase 1; brand tokens from `shared/brand/`.
- **Mobile**: Flutter (Phase 6) — single codebase for Android + iOS.

## Money

All monetary amounts are **integer minor units** (paise for INR) in a field suffixed `Minor`, always paired with a `currency` code (ISO 4217, default `INR`). Never floats, never a bare number without currency. Formatting to rupees happens only at display time. See `backend/src/lib/money.ts`.

## Data model (Phase 0)

Two distinct identities:
- **User** — staff/admin who operate the back office (roles: OWNER, ADMIN, STAFF).
- **Customer** — shoppers on the storefront and marketplaces.

Catalog: `Category` → `Product` → `ProductVariant` (the sellable unit, carries SKU + price). Stock is `InventoryItem` (variant × location). Selling happens on a `SalesChannel` (WEB, marketplaces). Orders (`Order` → `OrderItem`) reference the channel they came from, so marketplace orders flow through the same pipeline.

## Fulfilment (Phase 4)

- **Courier** behind a small abstraction (`backend/src/modules/fulfilment/courier.service.ts`): `COURIER_MODE=mock` issues an AWB and advances a mock tracking timeline one stage per sync (demoable without any account); `shiprocket` calls Shiprocket's REST API (auth + ad-hoc order) and needs `SHIPROCKET_*` + a pickup location. Live Shiprocket tracking sync is left to their webhook (sync returns 501 in that mode).
- **Shipment** (one per order) + **TrackingEvent**. Booking a shipment moves the order to `SHIPPED`; a mock delivery marks the order `DELIVERED`.
- **Documents** are server-rendered **printable HTML** (`documents.ts`) — GST invoice (CGST+SGST intra-state vs IGST inter-state by comparing buyer state to `SELLER_STATE`), delivery note (no prices), shipping label (AWB + ship-to, A6). No PDF dependency: the page has a Print button → the browser's Save-as-PDF. Document endpoints are staff-auth; the admin fetches them with the bearer token and opens a print window, so navigation never drops auth.
- Seller identity for documents comes from `SELLER_*` env (name, GSTIN, address, state). The invoice flags when GSTIN is unset.

## Back office / admin (Phase 3)

- A **separate Next.js app** in `admin/` (port 3001), so staff tokens and the admin bundle never mix with the storefront. Same brand tokens, same light/Evening themes, but a dense tool UI (sidebar shell, data tables, stat tiles, status pills).
- Uses the existing **staff auth** (`/api/auth/*`); all data comes from `/api/admin/*`, which is gated by `authenticate` + `requireRole(OWNER, ADMIN, STAFF)`.
- **Order status** changes go through a transition map (same on client and server); cancelling/returning releases reserved stock or restocks committed stock in a transaction.
- **Inventory** edits set on-hand per variant × location (`available = onHand − reserved`).
- CORS allows `http://localhost:3001` alongside the storefront origin.

## Web storefront (Phase 1)

- **Next.js 14.2 (App Router, TypeScript)** in `web/`. Server components fetch the catalog from the backend; a bundled sample catalog (`src/lib/sample.ts`) renders the shop before Postgres is running.
- Styling is plain CSS with brand tokens (`globals.css` + `components.css`), mirroring `shared/brand/`. Jost via `next/font`. No Tailwind — keeps it dependency-light and on-brand.
- Cart is client-side (React context + `localStorage`) until Phase 2 ties it to customer accounts and checkout.

## Checkout & payments (Phase 2)

- **Customer auth** is separate from staff auth: customer JWTs carry `typ: "customer"`, verified by a dedicated middleware; rotating refresh tokens in `customer_refresh_tokens`. The web client stores tokens in `localStorage` and refreshes once on a 401.
- **GST**: apparel slabs — 5% up to ₹1,000/piece, 12% above (`src/lib/tax.ts`). Simplified; production should drive rates from an HSN/tax table per product. The storefront shows a live estimate; the **server total is authoritative**.
- **Checkout** (`POST /api/checkout`): prices the cart server-side, computes GST + shipping, snapshots the shipping address onto the order, **reserves stock** (`InventoryItem.reserved`) in a transaction, and creates a `PENDING` order + a `Payment` row.
- **Payments**: `PAYMENT_MODE=mock` (dev: a simulated confirm endpoint) or `razorpay`. Razorpay orders are created via REST (no SDK dependency); the callback signature is verified with HMAC-SHA256. On success the order becomes `CONFIRMED` and reserved stock is **committed** (onHand and reserved decremented). Confirmation is idempotent on a non-PENDING order.
- **Order numbers**: `ALV-YYYY-NNNNN` from a per-year counter (move to a DB sequence before high volume).

### Security note — Next.js upgrade before launch
We pin the **Next 14.2.x** patched line (14.2.35+), which closes the critical middleware auth-bypass CVE. `npm audit` still lists many Next advisories whose fixes land only in the **Next 16** line; most do not apply to our current setup (plain `<img>`, no image optimizer with remote patterns, no Server Actions, no custom server). **Before public launch, upgrade to Next 16** (a breaking major bump — `params`/`searchParams` become async) and re-audit. Tracked as a pre-launch task.

## Conventions

- Every route validates input with Zod and returns a consistent error shape (`{ error: { code, message, details? } }`).
- IDs are CUIDs.
- Timestamps are UTC; `createdAt` / `updatedAt` on every table.
- Secrets only via environment (`.env`, validated in `src/env.ts`); never committed.
