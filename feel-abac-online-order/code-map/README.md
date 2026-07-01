# Code Map

This folder is a presentation-time shortcut for the project.

Use:

- `frontend-map.md` when you need to answer: "Which file controls this screen/UI/color/text?"
- `backend-map.md` when you need to answer: "How is the data fetched/saved/validated?"

## Important project pattern

This app is **not API-first for initial page render**.

- Many pages are **server components** in `app/[lang]/*` and fetch data directly from `lib/*/queries.ts`.
- The `/api/*` routes are used mostly for:
  - client-side mutations
  - small client refreshes
  - realtime auth
  - uploads
  - auth flows

So if someone asks "where does this page get its data?", the answer is often:

`route page` -> `lib/<feature>/queries.ts` -> `src/db/schema.ts`

and not always:

`route page` -> `/api/*`

## Fast demo cheatsheet

| If asked about... | Open these first |
| --- | --- |
| Landing page UI | `app/[lang]/page.tsx`, `components/auth/login-modal.tsx`, `dictionaries/en/landing.json` |
| Main diner menu UI | `app/[lang]/menu/page.tsx`, `components/menu/responsive-menu-browser.tsx`, `components/menu/menu-browser.tsx`, `components/menu/mobile/mobile-menu-browser.tsx` |
| Menu item detail UI | `app/[lang]/menu/items/[itemId]/page.tsx`, `components/menu/menu-item-detail.tsx` |
| Cart UI / submit order | `app/[lang]/cart/page.tsx`, `components/cart/cart-view.tsx`, `backend-map.md` order flow section |
| Order tracking UI | `app/[lang]/orders/[displayId]/page.tsx`, `components/orders/order-status-client.tsx` |
| Admin live orders UI | `app/[lang]/admin/orders/page.tsx`, `components/admin/orders/order-list-client.tsx` |
| Admin menu editor UI | `app/[lang]/admin/menu/page.tsx`, `components/admin/menu/menu-manager.tsx`, `components/admin/menu/menu-editor.tsx` |
| Delivery location UI | `app/[lang]/admin/delivery/page.tsx`, `components/admin/delivery/*`, `components/cart/delivery-location-picker.tsx`, `components/onboarding/onboarding-location-picker.tsx` |
| Shop open/closed logic | `app/[lang]/admin/settings/shop/page.tsx`, `components/admin/shop/shop-settings-client.tsx`, `lib/shop/queries.ts` |
| PromptPay/payment logic | `components/payments/*`, `components/payments/admin/*`, `app/api/orders/[displayId]/payment/route.ts`, `app/api/admin/orders/[displayId]/verify-payment/route.ts`, `lib/payments/*` |

## Global ownership reminders

- Global app shell: `app/layout.tsx`
- Locale shell: `app/[lang]/layout.tsx`
- Route/session/locale proxy: `proxy.ts`
- Global CSS: `app/globals.css`
- Shared UI primitives: `components/ui/*`
- Shared language controls: `components/i18n/*`
- Database schema: `src/db/schema.ts`

