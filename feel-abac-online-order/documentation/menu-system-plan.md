# Menu System Implementation Plan

## Objectives
- Extend `src/db/schema.ts` with menu data structures that support category → menu item → choice group → choice option hierarchy.
- Enable admins to manage menus, images, and option sets while keeping customer-facing rendering dynamic.
- Integrate Cloudflare R2 (S3-compatible) image handling with sharp-based processing hooks already present in the codebase.

## Phase 1 – Data Modeling
1. **Schema Additions (Drizzle ORM)**
   - Define tables for `menu_categories`, `menu_items`, `menu_choice_groups`, `menu_choice_options`.
   - Incorporate `display_order`, `is_active/is_available`, multilingual name/description columns, timestamps, and FK relationships.
   - Add `has_image` auto flag, optional `placeholder_icon`, and enforce admin-only ownership through existing auth logic.
   - Keep `price` and `extra_price` stored as THB decimals; ensure helpers format accordingly and do not expose multi-currency logic.
2. **Migrations**
   - Generate new migration for the menu tables.
   - Confirm referential integrity (cascade deletes from category → items → groups → options).
   - Update seed data scaffolding if needed for dev testing.

## Phase 2 – Storage & Media Handling
1. **Environment & Config**
   - Wire R2 credentials (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ACCOUNT_ID`, `R2_S3_ENDPOINT`) into shared S3-compatible client helper.
   - Reuse installed AWS SDK and sharp packages; provide typed wrapper (`lib/r2-client.ts`) to centralize configuration.
2. **Upload Pipeline**
   - Implement admin-only API routes for image upload/update/delete to keep backend logic isolated.
   - Use sharp for minor resizing/cropping as required before upload.
   - Persist resulting `image_url` and update `has_image` flag in `menu_items`.
3. **Image Maintenance**
   - Provide delete/replace flow that removes old object from R2 and updates DB flags.
   - Respect `placeholder_icon` when `image_url` absent.
4. **Caching Strategy**
   - Serve menu images and data responses with aggressive cache headers (long-lived `Cache-Control`, `ETag`/`Last-Modified`).
   - Document invalidation approach for rare updates (e.g., cache-busting query string on image replacement).

## Phase 3 – Admin Experience
1. **CRUD Interfaces**
   - Create full-screen admin pages under `app/admin/menu/**` for categories, items, choice groups, and options.
   - Support drag-and-drop ordering leveraging `display_order`.
   - Provide toggles for `is_active`/`is_available` and `allow_user_notes`.
   - Leverage existing component organization and Shadcn UI primitives (`dialog`, `sheet`, etc.) to match established admin UX.
   - Route all write operations through admin-protected API routes that encapsulate database calls.
2. **Validation & Feedback**
   - Enforce selection constraints (`min_select`, `max_select`, `is_required`) at creation time.
   - Surface toast/notification patterns consistent with existing admin UI (refer to `validation-toast-upgrade.md`).
3. **Authorization**
   - Reuse admin guards/middleware so only admins access CRUD endpoints.

## Phase 4 – Customer-Facing Rendering
1. **Menu Query Layer**
   - Build server function exposed through API routes to fetch active categories/items/groups/options ordered by `display_order`, with caching directives.
   - Apply locale fallback logic (`name_mm ?? name_en`, same for descriptions).
2. **Menu Page Updates**
   - Render menu cards with image (or placeholder), price, availability badges.
   - Dynamically generate selection controls: radio for `max_select === 1`, checkbox for `max_select > 1`.
   - Compute price total: base price + selected `extra_price`.
   - Show notes input when `allow_user_notes` true.
   - Display friendly empty state when no menu items exist.

## Phase 5 – Auxiliary Tasks
1. **Testing**
   - Outline test strategy for query layer and pricing calculations (implementation scheduled post-MVP).
   - Plan to mock R2 interactions for API tests when added.
2. **Documentation & Onboarding**
   - Update admin docs with menu management instructions once functionality is coded.
   - Provide seed script or sample migration data for QA/staging environments.

## Open Questions
- No change history required; retain last-write-wins for updates.
- Extra pricing remains THB-only; ensure formatting helpers assume single currency.
- Admin defines `max_select`; UI should respect stored limits without hard caps.
