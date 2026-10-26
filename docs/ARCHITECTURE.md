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

## Web storefront (Phase 1)

- **Next.js 14.2 (App Router, TypeScript)** in `web/`. Server components fetch the catalog from the backend; a bundled sample catalog (`src/lib/sample.ts`) renders the shop before Postgres is running.
- Styling is plain CSS with brand tokens (`globals.css` + `components.css`), mirroring `shared/brand/`. Jost via `next/font`. No Tailwind — keeps it dependency-light and on-brand.
- Cart is client-side (React context + `localStorage`) until Phase 2 ties it to customer accounts and checkout.

### Security note — Next.js upgrade before launch
We pin the **Next 14.2.x** patched line (14.2.35+), which closes the critical middleware auth-bypass CVE. `npm audit` still lists many Next advisories whose fixes land only in the **Next 16** line; most do not apply to our current setup (plain `<img>`, no image optimizer with remote patterns, no Server Actions, no custom server). **Before public launch, upgrade to Next 16** (a breaking major bump — `params`/`searchParams` become async) and re-audit. Tracked as a pre-launch task.

## Conventions

- Every route validates input with Zod and returns a consistent error shape (`{ error: { code, message, details? } }`).
- IDs are CUIDs.
- Timestamps are UTC; `createdAt` / `updatedAt` on every table.
- Secrets only via environment (`.env`, validated in `src/env.ts`); never committed.
