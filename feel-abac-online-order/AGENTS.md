# AGENTS Guide

## High-Level Structure
- `app/` - App Router entry point with locale segment `[lang]`.
  - Diner flows: `menu`, `menu/items/[itemId]`, `cart`, `orders`, `profile`, `onboarding`.
  - Admin flows: `admin/dashboard`, `admin/menu/*`, `admin/orders`, `admin/orders/archived`, `admin/delivery`, `admin/stock`, `admin/settings/*`.
- `components/` - Feature UI modules.
  - Admin: `components/admin/{menu,orders,delivery,promptpay,shop}`.
  - Diner: `components/{menu,cart,orders,payments,onboarding,profile}`.
  - Shared: `components/ui`, locale providers/toggles in `components/i18n`.
- `lib/` - Cross-cutting helpers for menu/cart/orders/delivery/auth/session/email/pusher/i18n.
- `src/db/schema.ts` - Drizzle table definitions; SQL migrations in `drizzle/`.
- `dictionaries/` - Locale copy (`en`, `my`).
- `public/` - Static assets and placeholders.

## Key App Routes
- `app/[lang]/layout.tsx`, `app/[lang]/page.tsx` - Locale shell and landing.
- `app/[lang]/menu/page.tsx` - Main menu browser (`ResponsiveMenuBrowser`).
- `app/[lang]/menu/items/[itemId]/page.tsx` - Menu item detail page.
- `app/[lang]/cart/page.tsx` - Cart + delivery selection + submit order.
- `app/[lang]/orders/[displayId]/page.tsx` - Customer order status and payment state.
- `app/[lang]/orders/[displayId]/receipt/page.tsx` - Customer receipt view/PDF.
- `app/[lang]/orders/page.tsx` - Order history tabs.
- `app/[lang]/onboarding/page.tsx` - Verification + delivery setup.
- `app/[lang]/profile/page.tsx` - Account/profile/settings.
- `app/[lang]/admin/orders/page.tsx` - Live admin order board.
- `app/[lang]/admin/orders/archived/page.tsx` - Archived orders with filtering.
- `app/[lang]/admin/delivery/page.tsx` - Delivery zone/building management.
- `app/[lang]/admin/stock/page.tsx` - Item availability control.
- `app/[lang]/admin/settings/{team,promptpay,shop}/page.tsx` - Admin settings surfaces.

## Important API Routes
- Public menu:
  - `app/api/menu/route.ts`
  - `app/api/menu/items/[itemId]/route.ts`
- Cart and customer order APIs:
  - `app/api/cart/route.ts`
  - `app/api/cart/items/[itemId]/route.ts`
  - `app/api/orders/route.ts`
  - `app/api/orders/[displayId]/route.ts`
  - `app/api/orders/[displayId]/cancel/route.ts`
  - `app/api/orders/[displayId]/payment/route.ts`
- Admin order APIs:
  - `app/api/admin/orders/[displayId]/status/route.ts`
  - `app/api/admin/orders/[displayId]/verify-payment/route.ts`
  - `app/api/admin/orders/[displayId]/reject-payment/route.ts`
- Admin menu APIs:
  - `app/api/admin/menu/{categories,items,choice-groups,choice-options}/...`
  - `app/api/admin/menu/tree/route.ts`
  - `app/api/admin/menu/images/route.ts`
  - `app/api/admin/menu/items/[itemId]/availability/route.ts`
  - Pools/recommended/reorder APIs under `app/api/admin/menu/*`.
- Delivery + user defaults:
  - `app/api/admin/delivery-locations/route.ts`
  - `app/api/admin/delivery-locations/[locationId]/route.ts`
  - `app/api/user/delivery-location/route.ts`
- Auth/user/admin helpers:
  - `app/api/auth/[...all]/route.ts`, forgot/reset password routes
  - `app/api/sign-{in,out,up}/route.ts`
  - `app/api/admin/{add,remove,list}/route.ts`
  - `app/api/user/{phone,has-password,delete-account}/route.ts`
- Realtime/upload/ops:
  - `app/api/pusher/auth/route.ts`
  - `app/api/uploadthing/route.ts`
  - `app/api/cron/cleanup-orders/route.ts`

## Feature Highlights
- Menu browsing is locale-aware and responsive (desktop + mobile) with deep links to item detail.
- Cart supports preset/custom delivery selection (Google Places search + map pin), item editing, and swipe-to-remove.
- Out-of-stock cart guard is server-validated at submit time and surfaced as a dedicated customer modal (scales for multiple unavailable items).
- Customer order status supports realtime updates (Pusher), payment QR/upload flow, refund messaging, and receipt download.
- Admin orders support realtime updates, accept/cancel/handoff/delivered actions, payment verify/reject, and archived history view.
- Admin order detail displays actual preset location name/building (not generic label fallback).
- Delivery locations, stock availability, promptpay accounts, and shop open/closed state are managed in dedicated admin surfaces.

## Build, Test, and Development Commands
- `npm run dev` - Launch Next.js dev server (Turbopack).
- `npm run lint` - Run ESLint.
- `npm run build` - Build production bundle.
- `npm run start` - Run production server.
- `npx drizzle-kit push` - Apply migrations to `DATABASE_URL`.

## Coding Style & Naming Conventions
- TypeScript everywhere, 2-space indentation.
- `camelCase` for functions/variables, `PascalCase` for components, kebab-case folders.
- Keep admin copy concise and task-oriented.
- Remote images must use `next/image` with host allowlist in `next.config.ts`.

## Testing Guidelines
- Run `npm run lint` plus manual flow verification.
- If full lint is blocked by unrelated pre-existing issues, run targeted lint on touched files and report residual failures explicitly.
- After schema/migration changes: run `npx drizzle-kit push`, restart dev server, and manually verify core flows:
  - menu browse + item detail
  - onboarding + delivery selection (preset/custom)
  - cart submit + out-of-stock modal behavior
  - payment upload/verify/reject
  - admin order actions + archived list

## Commit & Pull Request Guidelines
- Use conventional commits (`feat:`, `fix:`, `chore:`), present tense.
- PRs should include:
  - scope summary
  - verification steps (`npm run lint`, manual checks, migrations if any)
  - screenshots/GIFs for UI changes
  - linked ticket
- Rebase before opening; prefer squash merges unless instructed otherwise.

## Agent-Specific Notes
- Trim and validate IDs before calling Drizzle helpers.
- Dynamic route handlers receive `params` as a Promise; always `await params` before property access.
- Respect active `[lang]` segment:
  - route using `withLocalePath`
  - hydrate UI copy with `getDictionary`
  - keep English/Burmese dictionaries in sync when adding keys.
- Always keep menu language toggle behavior intact via `menuLocale` provider/cookie.
- Database clients:
  - `src/db/client.ts` (`drizzle-orm/neon-http`) for regular single-statement/idempotent operations.
  - `src/db/tx-client.ts` (`drizzle-orm/neon-serverless`) for ACID transactions.
  - `lib/orders/create.ts:createOrderFromCart` is the canonical transaction pattern for multi-table writes.
- Out-of-stock submit guard:
  - `createOrderFromCart` throws `OrderItemsUnavailableError` (`code: ORDER_ITEMS_UNAVAILABLE`) with structured unavailable items.
  - `app/api/orders/route.ts` maps that to HTTP `409` with payload `{ code, unavailableItems }`.
  - `components/cart/cart-view.tsx` displays that payload in a modal; avoid adding extra fetches for this UI.
- Admin delivery label accuracy:
  - `getOrderByDisplayId` and `getOrderDetailForAdmin` join delivery location/building names into `OrderRecord`.
  - Do not regress to hardcoded `"Preset location"` when preset IDs are present.
- Delivery picker mobile UX:
  - Keep `SelectContent` anchored with contained scroll to prevent viewport-jump issues on small screens (`components/cart/delivery-location-picker.tsx`, `components/onboarding/onboarding-location-picker.tsx`).
- Realtime order envs:
  - Server: `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`
  - Client: `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`
