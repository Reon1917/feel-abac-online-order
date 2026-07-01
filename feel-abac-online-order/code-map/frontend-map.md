# Frontend Map

## 1. Frontend structure at a glance

| Folder / file | Responsibility |
| --- | --- |
| `app/` | Next.js App Router pages and layouts. Most route files are server components that fetch initial data. |
| `app/[lang]/...` | Locale-aware customer and admin screens. This is where each page entry lives. |
| `components/` | Real UI implementation. Most screen behavior lives here, not in the route page. |
| `components/ui/` | Shared UI primitives such as buttons, dialogs, inputs, tables, selects. |
| `components/i18n/` | Language switchers and the menu language provider/cookie behavior. |
| `dictionaries/en/*.json`, `dictionaries/my/*.json` | UI copy for English and Burmese. Add keys in both. |
| `app/globals.css` | Global base styles. |
| `components/menu/mobile/mobile-menu.module.css` | Custom CSS module for the mobile menu browser. |

## 2. Shared frontend owners

| UI area | Main files |
| --- | --- |
| Root HTML shell + toaster | `app/layout.tsx` |
| Locale wrapper + menu locale provider | `app/[lang]/layout.tsx`, `components/i18n/menu-locale-provider.tsx` |
| Diner mobile/desktop navigation | `components/menu/mobile-bottom-nav.tsx` |
| Admin app frame | `components/admin/admin-layout-shell.tsx`, `components/admin/admin-sidebar.tsx`, `components/admin/admin-header.tsx`, `components/admin/admin-main-content.tsx` |
| Shared dialogs/buttons/inputs | `components/ui/dialog.tsx`, `components/ui/button.tsx`, `components/ui/input.tsx`, `components/ui/select.tsx` |
| Global auth modal | `components/auth/login-modal.tsx` |

## 3. Diner/customer UI map

| Screen | Route file | Main UI files | Initial data source | Client-side actions |
| --- | --- | --- | --- | --- |
| Landing / sign in | `app/[lang]/page.tsx` | `components/auth/login-modal.tsx`, `components/i18n/ui-language-switcher.tsx` | Dictionary-only page | Login modal calls `/api/sign-in` and `/api/sign-up`; Google sign-in uses `lib/auth-client.ts` |
| Menu list | `app/[lang]/menu/page.tsx` | `components/menu/responsive-menu-browser.tsx`, `components/menu/menu-browser.tsx`, `components/menu/mobile/mobile-menu-browser.tsx`, `components/orders/resume-order-banner.tsx`, `components/shop/shop-closed-overlay.tsx` | `getUserProfile`, `getPublicMenuHierarchy`, `getPublicRecommendedMenuItems`, `getActiveCartSummary`, `getShopStatus` | Quick add uses `components/menu/use-quick-add.ts` -> `/api/cart`; cart badge/nav uses `/api/cart` |
| Menu item detail | `app/[lang]/menu/items/[itemId]/page.tsx` | `components/menu/menu-item-detail.tsx`, `components/menu/set-menu-builder.tsx`, `components/menu/add-to-cart-footer.tsx`, `components/menu/out-of-stock-notice.tsx` | `getPublicMenuItemById` | Standard item add -> `/api/cart`; set menu add -> `/api/cart/set-menu` |
| Cart | `app/[lang]/cart/page.tsx` | `components/cart/cart-view.tsx`, `components/cart/delivery-location-picker.tsx`, `components/cart/swipe-to-remove.tsx` | `getActiveCartForUser`, `getActiveDeliveryLocations`, `getUserProfile`, `getShopStatus` | Remove/edit cart lines -> `/api/cart/items/[itemId]`; save phone -> `/api/user/phone`; save delivery preference -> `/api/user/delivery-location`; submit order -> `/api/orders` |
| Onboarding | `app/[lang]/onboarding/page.tsx` | `components/onboarding/onboarding-wizard.tsx`, `components/onboarding/onboarding-phone.tsx`, `components/onboarding/onboarding-location-picker.tsx`, `components/onboarding/onboarding-welcome.tsx` | `getUserProfile`, `getActiveDeliveryLocations` | Uses server actions in `app/[lang]/onboarding/actions.ts` instead of normal API fetch for final completion |
| Orders list/history | `app/[lang]/orders/page.tsx` | `components/orders/orders-client.tsx` | `getOrdersForUser`, `getUserProfile` | Mostly client filtering/tab UI; links into order detail |
| Single order tracking | `app/[lang]/orders/[displayId]/page.tsx` | `components/orders/order-status-client.tsx`, `components/payments/payment-qr-section.tsx`, `components/payments/refund-notice-banner.tsx`, `components/orders/contact-feel-abac-banner.tsx` | `getOrderByDisplayId` | Refresh order -> `/api/orders/[displayId]`; cancel -> `/api/orders/[displayId]/cancel`; receipt upload -> `/api/orders/[displayId]/payment`; realtime via Pusher |
| Receipt / printable receipt | `app/[lang]/orders/[displayId]/receipt/page.tsx` | `components/orders/receipt-view.tsx` | `getOrderByDisplayId` plus delivery location lookup | `receipt-view.tsx` uses inline styles for print/PDF-like rendering |
| Profile | `app/[lang]/profile/page.tsx` | `components/profile/profile-client.tsx`, `components/i18n/ui-language-switcher.tsx`, `components/i18n/menu-language-toggle.tsx` | `getUserProfile`, `getLinkedProviders` | Name/phone edits use server actions in `app/[lang]/profile/actions.ts`; delete account -> `/api/user/delete-account` |
| Forgot/reset password | `app/[lang]/auth/forgot-password/page.tsx`, `app/[lang]/auth/reset-password/page.tsx` | `components/auth/forgot-password-form.tsx`, `components/auth/reset-password-form.tsx` | Page shells only | `/api/auth/forgot-password`, `/api/auth/reset-password` |

## 4. Admin UI map

| Screen | Route file | Main UI files | Initial data source | Client-side actions |
| --- | --- | --- | --- | --- |
| Admin dashboard | `app/[lang]/admin/dashboard/page.tsx` | `components/admin/admin-layout-shell.tsx`, `components/admin/admin-header.tsx`, `components/admin/stats-card.tsx` | `getTodayOrdersForAdmin`, `countLiveAdminOrders`, `countCompletedAdminOrders`, `getActivePromptPayAccount` | Mostly navigation/dashboard links |
| Live orders board | `app/[lang]/admin/orders/page.tsx` | `components/admin/orders/order-list-client.tsx`, `components/admin/orders/order-detail-modal.tsx`, `components/admin/orders/accept-order-modal.tsx`, `components/admin/orders/reject-order-dialog.tsx`, `components/payments/admin/receipt-review.tsx` | `getTodayOrdersForAdmin` | `/api/orders/[displayId]`, `/api/admin/orders/[displayId]/status`, `/api/admin/orders/[displayId]/verify-payment`, `/api/admin/orders/[displayId]/reject-payment`; realtime via Pusher |
| Archived orders | `app/[lang]/admin/orders/archived/page.tsx` | `components/admin/orders/archived-orders-client.tsx` | `getArchivedOrderDays`, `getArchivedOrdersForAdminFiltered` | Similar admin order status APIs |
| Menu builder | `app/[lang]/admin/menu/page.tsx` | `components/admin/menu/menu-manager.tsx`, `components/admin/menu/menu-editor.tsx`, `components/admin/menu/store.ts` | `getAdminMenuHierarchy` | `/api/admin/menu/tree`, `/api/admin/menu/categories`, `/api/admin/menu/items`, `/api/admin/menu/choice-groups`, `/api/admin/menu/choice-options`, `/api/admin/menu/images`, reorder endpoints |
| Menu layout editor | `app/[lang]/admin/menu/layout/page.tsx` | `components/admin/menu/menu-layout-editor.tsx` | `getAdminMenuHierarchy` | Uses menu tree/reorder endpoints |
| Choice pools for set menus | `app/[lang]/admin/menu/pools/page.tsx` | `components/admin/menu/pool-manager.tsx`, `components/admin/menu/pool-api-client.ts` | `getAllChoicePools` | `/api/admin/menu/pools`, `/api/admin/menu/pools/[poolId]`, option/reorder/duplicate endpoints |
| Staff's Picks / recommendations | `app/[lang]/admin/menu/recommended/page.tsx` | `components/admin/menu/recommended-items-card.tsx` | `getAdminMenuHierarchy`, `getAdminRecommendedMenuItems` | `/api/admin/menu/recommended`, reorder/delete endpoints |
| Delivery preset management | `app/[lang]/admin/delivery/page.tsx` | `components/admin/delivery/location-form.tsx`, `components/admin/delivery/location-edit-dialog.tsx`, `components/admin/delivery/delete-location-button.tsx`, `components/admin/delivery/building-fields.tsx` | `getDeliveryLocationsForAdmin` | `/api/admin/delivery-locations`, `/api/admin/delivery-locations/[locationId]` |
| Stock / availability | `app/[lang]/admin/stock/page.tsx` | `app/[lang]/admin/stock/stock-control-client.tsx` | `getStockControlData` | `/api/admin/menu/items/[itemId]/availability` |
| Reports | `app/[lang]/admin/reports/page.tsx` | `components/admin/admin-header.tsx`, shared stat cards/buttons | `getOrdersForAdminReport`, `buildAdminSalesAnalytics` | Query params drive date range; mostly server-rendered analytics |
| Team access | `app/[lang]/admin/settings/team/page.tsx` | `app/[lang]/admin/settings/team/team-access-client.tsx`, `app/[lang]/admin/settings/team/invite-admin-modal.tsx` | Direct DB read of `admins` table in page | `/api/admin/list`, `/api/admin/add`, `/api/admin/remove` |
| PromptPay settings | `app/[lang]/admin/settings/promptpay/page.tsx` | `components/admin/promptpay/promptpay-accounts-client.tsx` | `listPromptPayAccounts` | `/api/admin/promptpay-accounts`, activate/delete endpoints |
| Shop open/closed settings | `app/[lang]/admin/settings/shop/page.tsx` | `components/admin/shop/shop-settings-client.tsx` | `getShopStatus` | `/api/admin/settings/shop` |

## 5. Feature-folder ownership

| Folder | Owns this UI area |
| --- | --- |
| `components/menu/` | Diner menu browsing, detail page, add-to-cart, set-menu builder, cart peek button |
| `components/menu/mobile/` | Mobile-only menu presentation and CSS module |
| `components/cart/` | Cart screen, delivery picker, swipe removal, submit-order modal logic |
| `components/orders/` | Order tracking page, order list/history, receipt render |
| `components/payments/` | Customer payment QR, receipt upload, rejection/refund banners |
| `components/payments/admin/` | Admin payment verification/review UI |
| `components/onboarding/` | First-time user setup flow |
| `components/profile/` | Account/profile/settings UI |
| `components/admin/orders/` | Live board, archived list, order detail modal, accept/reject/payment admin actions |
| `components/admin/menu/` | Admin menu CRUD, layout editing, pools, recommendations |
| `components/admin/delivery/` | Admin delivery preset CRUD |
| `components/admin/promptpay/` | Admin PromptPay account management |
| `components/admin/shop/` | Shop open/close settings UI |
| `components/map/` | Google Maps / location visual selection helpers |

## 6. If you need to make a quick UI change

### Change page colors / spacing / typography

- First open the route file for the page shell in `app/[lang]/...`.
- Then open the feature component listed above.
- Most colors are hardcoded as Tailwind classes directly inside the JSX, so small color changes are usually local edits.

### Change reusable button / dialog styling across many screens

- Check `components/ui/button.tsx`
- Check `components/ui/dialog.tsx`
- Check `components/ui/input.tsx`, `components/ui/select.tsx`

### Change global background or baseline styles

- Check `app/layout.tsx`
- Check `app/globals.css`

### Change text/copy

- Check the matching file in `dictionaries/en/*.json`
- Mirror the same key in `dictionaries/my/*.json`

### Change receipt PDF look

- `components/orders/receipt-view.tsx`
- This file uses inline style objects, not only Tailwind classes.

### Change mobile menu look specifically

- `components/menu/mobile/mobile-menu-browser.tsx`
- `components/menu/mobile/mobile-menu.module.css`

## 7. Frontend data-fetching rule of thumb

For most screens:

1. Route page in `app/[lang]/*` loads initial data on the server.
2. Main interactive component in `components/*` renders the UI.
3. Buttons/forms then call either:
   - `/api/*` route handlers, or
   - server actions in `app/[lang]/*/actions.ts`

Presentation shortcut:

- "Initial page load" = look in the route page imports from `lib/*/queries.ts`
- "What happens when the user clicks save/submit?" = look in the feature component for `fetch(...)` or `useActionState(...)`

