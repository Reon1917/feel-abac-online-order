# Recommended Items Plan

## Objectives
- Introduce a persistent way to flag and order recommended dishes without duplicating menu data.
- Provide an admin workflow to curate recommendations by category/item while reusing existing card UI.
- Surface recommendations at the top of diner menu pages with optimized, mobile-friendly cards and shared image caching to avoid duplicate fetches.

## Phase 1 – Data Modeling
1. **Schema (`src/db/schema.ts`)**
   - Create `recommended_menu_items` table: `id` (serial), `restaurant_id` FK, `menu_category_id` FK, `menu_item_id` FK, `display_order`, timestamps.
   - Enforce uniqueness on `(restaurant_id, menu_item_id)` and `(restaurant_id, display_order)` so an item is only recommended once and ordering stays deterministic.
   - Cascade delete when a menu item or category is removed; respect existing tenant scoping helpers.
2. **Migrations (`drizzle/`)**
   - Generate SQL migration for the new table and constraints.
   - Backfill sample rows for dev/staging if seed scripts exist.

## Phase 2 – Admin Management Flow
1. **Repository Layer**
   - Add Drizzle helpers under `lib/menu/queries.ts` (or new `lib/menu/recommended.ts`) for CRUD plus a typed DTO (uses `zod` schema).
2. **API Routes (`app/api/admin/menu/recommended`)**
   - REST-ish handlers: `GET` (list for restaurant), `POST` (create), `PATCH` (reorder bulk), `DELETE`.
   - Validate payloads with shared schemas; trim IDs before DB calls per agent notes.
3. **Admin UI (`components/admin/menu`)**
   - New panel (e.g., `RecommendedItemsSection`) that:
     - Selects a category first (dropdown filtering by existing categories sorted by `display_order`).
     - After choosing a category, loads items from that category ordered by their `display_order`, allowing admins to add to recommendations.
     - Displays current recommendations with drag-and-drop (reusing builder sorting patterns) and remove buttons.
   - Surface feedback via existing toast utilities, reuse `MenuItemCard` preview to show what diners will see.

## Phase 3 – Public Query Layer
1. **Data Fetch**
   - Extend `getPublicMenu` (or add `getRecommendedMenuItems`) to return recommended sequence with embedded `menu_item` and `category` data while respecting locale fields and `is_available`.
   - Ensure query eager-loads `image_url`, `placeholder_icon`, and any computed totals required by the card UI.
2. **Caching**
   - Apply `revalidateTag('menu')` or equivalent caching metadata so recommendations are invalidated alongside menu updates.
   - Return deterministic order by `display_order` for consistent rendering.

## Phase 4 – Diner UI Integration
1. **Menu Page (`app/[lang]/menu/page.tsx`)**
   - Fetch recommended list alongside the standard menu data; pass both to `ResponsiveMenuBrowser`.
   - When rendering, show a “Recommended Items” section pinned above the normal category accordion/list.
2. **Card Rendering (`components/menu/menu-browser.tsx`, `components/menu/mobile/mobile-menu-browser.tsx`)**
   - Reuse existing `MenuItemCard` but allow variant props (e.g., `variant="recommended"` for denser spacing/background tweaks).
   - Ensure tapping/clicking still deep-links to the detail page.
3. **Duplicate Handling**
   - Recommended block is a secondary view over the same models, so do not mutate base category data. Cards below should still show the item within its category.
   - Build an `ImageAssetCacheContext` (or lightweight memo) so multiple cards referencing the same `image_url` share a single `Image` component props object and preloaded metadata.
   - Where feasible, pass a shared `imageLoaderKey` so Next.js caches the request; avoid forcing `priority` on both copies.

## Phase 5 – Mobile Optimizations
1. **Layout**
   - Convert recommended cards into a horizontally scrollable carousel on mobile with snap alignment, while desktop keeps a grid (2-3 columns).
   - Reduce padding/top margins to keep fold height low; ensure section title uses `MenuLanguageToggle` typography.
2. **Performance**
   - Lazy-load non-visible recommended cards using IntersectionObserver hook already used by menu list, so mobile browsers do not render off-screen cards eagerly.
   - Preload detail routes for the first few cards only to reduce bundle churn.

## Phase 6 – Validation & Testing
1. **Lint + Manual QA**
   - Run `npm run lint`.
   - Manually verify admin can add/remove/sort recommendations, and diner UI updates after refresh.
   - Confirm images load once (monitor network tab, ensure no duplicate `image_url` requests).
2. **Future Tests**
   - Add unit coverage for new query helpers (ensuring ordering, tenant scoping) under `tests/lib/menu`.
   - Plan a Playwright spec to assert recommended carousel renders both desktop and mobile breakpoints once test suites are enabled.

## Open Questions
- Should recommendations support scheduling/auto-expiry? (out of scope for now).
- Consider per-locale curated copy or badge labels if marketing wants more flexibility later.
