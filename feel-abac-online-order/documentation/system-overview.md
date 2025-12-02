# System Overview – Feel ABAC Online Order

## Purpose
- Bring Feel Restaurant’s ABAC-campus ordering flow online.
- Let students and staff quickly browse the menu, place delivery orders, and track status.
- Give admins a focused back office for menus, delivery zones, and live orders.

## Core Domains
- **Auth & Onboarding**
  - Better Auth + Drizzle sessions.
  - Onboarding captures phone number and default delivery selection before unlocking the menu.
- **Menu**
  - Admin-managed hierarchy: categories → items → choice groups → options.
  - R2-backed menu images processed with `sharp` (resize + WebP) and placeholder icons when missing.
  - Diner-facing browsers for desktop/mobile with item detail pages and quick-add to cart.
- **Cart & Orders**
  - Cart tracks items, choices, notes, and delivery selection.
  - Orders mirror cart content with Bangkok day-based `display_id` (e.g. `OR0001`) and status transitions.
  - Order history (`/orders`) plus per-order tracking (`/orders/[displayId]`).
- **Delivery**
  - Curated delivery locations + buildings for campus condos.
  - Persisted preset or custom address selection on user profiles to avoid repeated Google Places calls.
- **Payments (PromptPay)**
  - Two-stage food + delivery fee model with PromptPay QR codes and manual receipt verification (planned/partially implemented).
- **Realtime**
  - Pusher-backed updates for admin order dashboards and diner order status pages.

## Navigation Shells
- **Diner shell**
  - Locale-aware `[lang]` routes with static dictionary-based copy.
  - Shared nav component: bottom bar on mobile, compact side rail on desktop (`Home/Menu`, `Cart`, `Orders`, `Profile`).
- **Admin shell**
  - Emerald admin bar when `isAdmin` is true, with “Back to dashboard” affordance.
  - Admin-only routes under `app/[lang]/admin/**` guarded via `proxy.ts` and `requireActiveAdmin`.

## Data & Infra Highlights
- **Database**
  - Postgres (Neon) with Drizzle ORM.
  - HTTP driver (`neon-http`) for general queries; WebSocket driver (`neon-serverless` via `dbTx`) for interactive transactions (e.g. cart → order).
- **Storage**
  - Cloudflare R2 for menu images with a typed S3-compatible client and `sharp` at upload time.
  - UploadThing planned for payment receipts.
- **i18n**
  - `en` / `my` via static JSON dictionaries, resolved by `getDictionary(locale, surface)`.
  - UI language (`[lang]` segment) and menu-content language (separate toggle) kept distinct.

