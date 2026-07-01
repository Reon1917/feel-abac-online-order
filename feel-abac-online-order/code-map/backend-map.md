# Backend Map

## 1. Core backend pattern

This codebase uses a layered backend:

1. `proxy.ts` resolves locale, auth state, onboarding state, and injects `x-feel-session`
2. `app/api/*/route.ts` handles HTTP requests for client-side actions
3. `lib/api/*` checks auth and admin permissions
4. `lib/<feature>/*` runs business logic and DB queries
5. `src/db/schema.ts` defines the tables
6. `lib/orders/realtime.ts`, `lib/email/*`, `app/api/uploadthing/*` handle integrations

Important:

- Many page loads skip `/api/*` completely and call `lib/*/queries.ts` directly from server components.
- `/api/*` is mainly for **mutations, incremental refreshes, uploads, and realtime/auth helpers**.

## 2. Request/session/auth ownership

| File | Responsibility |
| --- | --- |
| `proxy.ts` | Locale redirect logic, protected-route gating, onboarding redirects, admin redirects, injects `x-feel-session` and `x-feel-locale` into the request |
| `lib/auth.ts` | Better Auth setup, email/password auth, Google auth, password reset email, delete-account rules |
| `lib/session.ts` | Reads `x-feel-session` header inside server components/pages |
| `lib/api/require-user.ts` | Resolves authenticated user from request headers for API routes |
| `lib/api/require-admin.ts` | Simple active-admin check for API routes |
| `lib/api/admin-guard.ts` | Role/permission-based admin guard helpers like menu access, PromptPay access, delivery access, super admin access |

## 3. Database ownership

| File | Responsibility |
| --- | --- |
| `src/db/schema.ts` | All Drizzle table definitions |
| `src/db/client.ts` | Regular Neon HTTP Drizzle client |
| `src/db/tx-client.ts` | Transaction-capable Neon serverless client |
| `drizzle/*.sql` | Migration history |

### Table groups in `src/db/schema.ts`

| Domain | Tables |
| --- | --- |
| Auth/accounts | `users`, `sessions`, `accounts`, `verifications` |
| User profile/admin | `user_profiles`, `admins` |
| Delivery | `delivery_locations`, `delivery_buildings` |
| Payments/shop config | `promptpay_accounts`, `shop_settings` |
| Menu | `menu_categories`, `menu_items`, `recommended_menu_items`, `menu_choice_groups`, `menu_choice_options` |
| Set-menu pools | `choice_pools`, `choice_pool_options`, `set_menu_pool_links` |
| Cart | `carts`, `cart_items`, `cart_item_choices` |
| Orders | `orders`, `order_items`, `order_item_choices`, `order_payments`, `order_events` |

## 4. Business-logic modules by feature

| Feature | Main backend modules |
| --- | --- |
| Session/auth | `lib/auth.ts`, `lib/auth-client.ts`, `lib/auth/queries.ts`, `lib/session.ts` |
| User profile | `lib/user-profile.ts`, `lib/validations.ts`, `lib/crypto.ts` |
| Menu read/edit | `lib/menu/queries.ts`, `lib/menu/validators.ts`, `lib/menu/recommendations.ts`, `lib/menu/stock-queries.ts` |
| Set-menu pools | `lib/menu/pool-queries.ts`, `lib/menu/pool-types.ts` |
| Cart | `lib/cart/queries.ts`, `lib/cart/validation.ts`, `lib/cart/hash.ts`, `lib/cart/types.ts` |
| Orders | `lib/orders/create.ts`, `lib/orders/queries.ts`, `lib/orders/totals.ts`, `lib/orders/format.ts`, `lib/orders/active-order.ts`, `lib/orders/cleanup.ts`, `lib/orders/report-analytics.ts`, `lib/orders/admin-stats.ts` |
| Delivery | `lib/delivery/queries.ts`, `lib/delivery/mutations.ts`, `lib/delivery/validation.ts`, `lib/delivery/slugs.ts` |
| Payments | `lib/payments/queries.ts`, `lib/payments/receipt-queries.ts`, `lib/payments/promptpay.ts` |
| Shop status | `lib/shop/queries.ts` |
| Realtime | `lib/pusher/server.ts`, `lib/pusher/client.ts`, `lib/orders/events.ts`, `lib/orders/realtime.ts` |
| Email | `lib/email/order-status.ts`, `lib/email/brevo.ts`, `lib/email/templates/*` |
| Uploads | `app/api/uploadthing/route.ts`, `app/api/uploadthing/core.ts`, `lib/uploadthing.ts`, `lib/r2-client.ts`, `lib/menu/image-storage.ts` |

## 5. API surface map

| Feature | Main API routes | Typical caller(s) | Core backend modules | Main tables/integrations |
| --- | --- | --- | --- | --- |
| Sign in / sign up / sign out | `app/api/sign-in/route.ts`, `app/api/sign-up/route.ts`, `app/api/sign-out/route.ts` | `components/auth/login-modal.tsx`, sign-out buttons | `lib/auth.ts`, `lib/auth/queries.ts` | Better Auth, `users`, `accounts`, `sessions` |
| Password reset | `app/api/auth/forgot-password/route.ts`, `app/api/auth/reset-password/route.ts`, `app/api/auth/[...all]/route.ts` | Auth forms | `lib/auth.ts`, `lib/email/*` | Better Auth, email |
| Public menu read | `app/api/menu/route.ts`, `app/api/menu/items/[itemId]/route.ts` | Optional client reads; most initial page loads bypass API | `lib/menu/queries.ts`, `lib/menu/recommendations.ts` | Menu tables |
| Cart CRUD | `app/api/cart/route.ts`, `app/api/cart/items/[itemId]/route.ts`, `app/api/cart/set-menu/route.ts` | Menu quick add, detail add, cart page, mobile cart badge | `lib/cart/queries.ts`, `lib/cart/validation.ts`, `lib/menu/pool-queries.ts`, `lib/orders/active-order.ts` | Cart tables, menu tables |
| Customer orders | `app/api/orders/route.ts`, `app/api/orders/[displayId]/route.ts`, `app/api/orders/[displayId]/cancel/route.ts`, `app/api/orders/[displayId]/payment/route.ts` | Cart submit, order-status page, payment upload | `lib/orders/create.ts`, `lib/orders/queries.ts`, `lib/payments/receipt-queries.ts`, `lib/orders/realtime.ts` | Order tables, PromptPay data, Pusher |
| Admin order operations | `app/api/admin/orders/[displayId]/status/route.ts`, `app/api/admin/orders/[displayId]/verify-payment/route.ts`, `app/api/admin/orders/[displayId]/reject-payment/route.ts` | Admin live board, archived board, payment review UI | `lib/orders/realtime.ts`, `lib/payments/receipt-queries.ts`, `lib/payments/promptpay.ts`, `lib/orders/cleanup.ts`, `lib/email/order-status.ts` | Orders, order payments, order events, Pusher, email |
| Delivery presets + user delivery preference | `app/api/admin/delivery-locations/route.ts`, `app/api/admin/delivery-locations/[locationId]/route.ts`, `app/api/user/delivery-location/route.ts` | Admin delivery forms, cart delivery picker | `lib/delivery/mutations.ts`, `lib/delivery/validation.ts`, `lib/user-profile.ts` | Delivery tables, user profiles |
| User profile helpers | `app/api/user/phone/route.ts`, `app/api/user/has-password/route.ts`, `app/api/user/delete-account/route.ts` | Cart/profile forms | `lib/user-profile.ts`, `lib/auth.ts` | `user_profiles`, Better Auth |
| Admin team access | `app/api/admin/list/route.ts`, `app/api/admin/add/route.ts`, `app/api/admin/remove/route.ts` | Team access screen | `lib/api/admin-guard.ts`, `lib/admin.ts`, `lib/admin/permissions.ts` | `admins` |
| Admin menu CRUD | `app/api/admin/menu/tree/route.ts`, categories/items/choice-groups/choice-options routes, reorder routes, image routes, availability route | Admin menu builder, layout editor, stock screen | `lib/menu/queries.ts`, `lib/menu/validators.ts`, `lib/menu/recommendations.ts`, `lib/menu/pool-queries.ts` | Menu tables, upload/image infra, cache revalidation |
| Admin set-menu pools | `app/api/admin/menu/pools/*` | Pool manager, set-menu builder admin UI | `lib/menu/pool-queries.ts` | Pool tables |
| Admin recommendations | `app/api/admin/menu/recommended*` | Staff's Picks admin UI | `lib/menu/recommendations.ts` | `recommended_menu_items` |
| PromptPay settings | `app/api/admin/promptpay-accounts/route.ts`, `[id]/route.ts`, `[id]/activate/route.ts` | PromptPay settings UI | `lib/payments/queries.ts`, `lib/payments/promptpay.ts` | `promptpay_accounts` |
| Shop settings | `app/api/admin/settings/shop/route.ts` | Shop settings UI | `lib/shop/queries.ts` | `shop_settings` |
| Realtime auth + sounds | `app/api/pusher/auth/route.ts`, `app/api/admin/sounds/[sound]/route.ts` | Order tracking page, admin live board | `lib/orders/events.ts`, `lib/orders/queries.ts`, `lib/pusher/server.ts` | Pusher |
| Uploads | `app/api/uploadthing/route.ts`, `app/api/uploadthing/core.ts` | Receipt uploads, menu image uploads | `lib/uploadthing.ts`, `lib/r2-client.ts` | UploadThing / storage |
| Cleanup/ops | `app/api/cron/cleanup-orders/route.ts` | Cron | `lib/orders/cleanup.ts` | `order_events`, order maintenance |

## 6. High-value data flows

### A. Main menu first render

`app/[lang]/menu/page.tsx`

- checks session with `getSession`
- checks onboarding with `getUserProfile`
- checks shop state with `getShopStatus`
- loads categories with `getPublicMenuHierarchy`
- loads featured items with `getPublicRecommendedMenuItems`
- loads cart badge summary with `getActiveCartSummary`

Key backend files:

- `lib/menu/queries.ts`
- `lib/menu/recommendations.ts`
- `lib/cart/queries.ts`
- `lib/shop/queries.ts`

### B. Quick add / normal add to cart

UI path:

- `components/menu/use-quick-add.ts`
- `components/menu/menu-item-detail.tsx`

HTTP path:

- `/api/cart`
- `/api/cart/set-menu`

Logic path:

- `lib/cart/queries.ts`
- `lib/cart/validation.ts`
- `lib/menu/pool-queries.ts` for set menus
- `lib/orders/active-order.ts` to block new cart actions when unpaid orders exist

Tables touched:

- `carts`
- `cart_items`
- `cart_item_choices`

### C. Submit order from cart

UI path:

- `components/cart/cart-view.tsx` -> `fetch("/api/orders")`

HTTP path:

- `app/api/orders/route.ts`

Logic path:

- `lib/orders/create.ts`

What `createOrderFromCart` handles:

- validates profile and cart
- checks out-of-stock items
- checks active unpaid order block
- calculates totals
- copies cart lines into order tables
- creates order events
- broadcasts realtime order-submitted event

Tables touched:

- `orders`
- `order_items`
- `order_item_choices`
- `order_events`
- cart tables

Integrations:

- Pusher via `lib/orders/realtime.ts`

### D. Customer order status + realtime

Initial render:

- `app/[lang]/orders/[displayId]/page.tsx` -> `getOrderByDisplayId`

Client refresh:

- `components/orders/order-status-client.tsx` -> `/api/orders/[displayId]`

Realtime:

- private channel auth via `app/api/pusher/auth/route.ts`
- event names/types in `lib/orders/events.ts`
- server broadcasts in `lib/orders/realtime.ts`

### E. Payment upload and admin verification

Customer upload:

- `components/payments/receipt-upload-button.tsx`
- `/api/orders/[displayId]/payment`
- `lib/payments/receipt-queries.ts` -> `markReceiptUploaded`, `updateOrderStatusForPayment`

Admin verification/rejection:

- `components/payments/admin/receipt-review.tsx`
- `/api/admin/orders/[displayId]/verify-payment`
- `/api/admin/orders/[displayId]/reject-payment`
- `lib/payments/receipt-queries.ts` -> `verifyPayment` / `rejectPayment`
- `lib/orders/realtime.ts` broadcasts result

Tables touched:

- `order_payments`
- `orders`
- `order_events`

### F. Admin accepts order and creates PromptPay payment

UI path:

- `components/admin/orders/order-list-client.tsx`

HTTP path:

- `/api/admin/orders/[displayId]/status` with action `"accept"`

Logic inside route:

- validates admin
- loads active PromptPay account
- recalculates order totals
- writes delivery fee and total
- creates combined payment QR payload
- updates order status
- sends realtime + email updates

Main files:

- `app/api/admin/orders/[displayId]/status/route.ts`
- `lib/payments/promptpay.ts`
- `lib/payments/queries.ts`
- `lib/orders/realtime.ts`
- `lib/email/order-status.ts`

### G. Onboarding and profile updates

Onboarding:

- UI: `components/onboarding/onboarding-wizard.tsx`
- server actions: `app/[lang]/onboarding/actions.ts`
- persistence: `lib/user-profile.ts`

Profile:

- UI: `components/profile/profile-client.tsx`
- server actions: `app/[lang]/profile/actions.ts`
- delete account API: `app/api/user/delete-account/route.ts`

Important note:

- Not every mutation uses `/api/*`; onboarding and profile name/phone updates also use server actions.

### H. Admin menu editing

UI path:

- `components/admin/menu/menu-manager.tsx`
- `components/admin/menu/menu-editor.tsx`
- `components/admin/menu/menu-layout-editor.tsx`
- `components/admin/menu/pool-manager.tsx`
- `components/admin/menu/recommended-items-card.tsx`

HTTP path:

- `/api/admin/menu/tree`
- `/api/admin/menu/categories*`
- `/api/admin/menu/items*`
- `/api/admin/menu/choice-groups*`
- `/api/admin/menu/choice-options*`
- `/api/admin/menu/pools*`
- `/api/admin/menu/recommended*`
- `/api/admin/menu/reorder`
- `/api/admin/menu/items/[itemId]/availability`

Logic path:

- `lib/menu/queries.ts`
- `lib/menu/validators.ts`
- `lib/menu/pool-queries.ts`
- `lib/menu/recommendations.ts`
- `lib/menu/stock-queries.ts`

Important caching note:

- Public menu reads come from `getPublicMenuHierarchy` in `lib/menu/queries.ts`
- That query is cached with the `public-menu` tag
- Admin mutations revalidate that tag when diner-visible menu data changes

## 7. If your professor asks "how is the data fetched?"

Use this answer template:

### Initial page load

- "This page is a server component under `app/[lang]/...`."
- "It usually fetches initial data directly from `lib/<feature>/queries.ts`."

### User action

- "The interactive component in `components/...` calls either an API route or a server action."

### Persistence

- "The route/action hands off to `lib/<feature>/*`, which uses Drizzle with tables from `src/db/schema.ts`."

### Realtime, if relevant

- "Order updates use Pusher through `lib/orders/realtime.ts` and `app/api/pusher/auth/route.ts`."

## 8. Best files to open first during Q&A

| Question type | Open these files first |
| --- | --- |
| "Where does this page get its first data?" | The matching `app/[lang]/.../page.tsx` file, then the imported `lib/*/queries.ts` file |
| "What saves this form?" | The interactive component in `components/...`, then the `fetch(...)` target API route or `actions.ts` server action |
| "Which DB table stores this?" | `src/db/schema.ts`, then the relevant `lib/*` module |
| "How are order status changes pushed live?" | `components/orders/order-status-client.tsx`, `components/admin/orders/order-list-client.tsx`, `lib/orders/events.ts`, `lib/orders/realtime.ts`, `app/api/pusher/auth/route.ts` |
| "How are permissions enforced?" | `proxy.ts`, `lib/api/admin-guard.ts`, `lib/api/require-admin.ts`, `lib/api/require-user.ts` |

