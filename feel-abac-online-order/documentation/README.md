# Documentation Index

This folder contains the core implementation notes and planning docs for the Feel ABAC online ordering system. Use this as the entry point instead of hunting for scattered markdown files.

## Core System Docs

- `system-overview.md` – High-level purpose and domain overview (auth, menu, cart/orders, delivery, payments, realtime) plus shells, data, and infra highlights.
- `admin-system.md` – Summary of the admin system: `admins` schema, guards in `proxy.ts`, `lib/session` shape, admin dashboard, and the emerald admin bar.
- `menu-system-plan.md` – End-to-end menu system design: schema for categories/items/choice groups/options, R2 image storage, and diner-facing rendering.
- `menu-layout-editor-plan.md` – Layout editor for reordering categories and items in bulk, including the `/admin/menu/layout` route and reorder API.
- `order-schema-plan.md` – Order data model (orders, items, choices, payments, events) and how the day-based `display_id` system works.
- `delivery-locations-plan.md` – Admin CRUD and diner selection UX for delivery locations and buildings.
- `delivery-location-persistence-plan.md` – How delivery selections are persisted on the profile and reused in the cart/checkout flow, with notes about Place Details caching.
- `map-implementation.md` – How the Google Maps preview integrates with delivery locations and cached coordinates.
- `realtime-ordering-plan.md` – Pusher-based realtime updates for admin orders and diner order status views.
- `quick-add-cart-plan.md` – “+” button behavior on menu cards, including choice-group constraints and scroll/return behavior.
- `recommended-items-plan.md` – Recommended/featured items surfaces on menu pages and their copy/UX.
- `two-stage-promptpay-payment-plan.md` – Two-stage PromptPay flow and how food vs delivery payments are modeled, plus an implementation checklist.
- `validation-toast-upgrade.md` – Guidelines for consistent validation and toast copy across admin and diner surfaces.
- `i18n-implementation-plan.md` – i18n architecture, dictionaries, and how `[lang]` routing + `getDictionary` work together, including open translation TODOs.

## Auth & Onboarding

- `initial-commit.md` – Snapshot of the initial auth + onboarding setup: Better Auth integration, `/onboarding`, and session header forwarding via `proxy.ts`.

## Notifications & Integrations

- `pushwoosh-notification-plan.md` – Outline for Pushwoosh integration and how notifications tie into the order lifecycle.

## How to Use These Docs

- Treat the **Core System Docs** as the canonical reference for how admin, menu, orders, delivery, and realtime features are supposed to behave.
- Use the **Auth & Onboarding** and **Notifications & Integrations** docs as background/context when modifying those areas.
- When you add new feature docs, place them here and keep file names kebab-cased (`feature-name-plan.md`) so the index stays tidy.
