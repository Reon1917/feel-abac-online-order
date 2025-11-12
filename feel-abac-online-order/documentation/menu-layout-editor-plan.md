# Menu Display Order Layout Editor Plan

## Goals & Constraints
- Enable admins to re-order menu categories and the items within a single category without editing any other attributes.
- Keep API chatter low by batching writes; nothing hits the backend until the user clicks a single “Apply display order changes” action.
- Preserve strong typing (Drizzle + Zod) and existing menu data contracts so both admin and diner-facing surfaces stay in sync.
- Deliver a slim UI that matches the current admin workspace (Shadcn primitives, emerald accent, responsive down to mobile).
- Support all locales via `getDictionary` strings; fall back to English copy until translations land.

## Access & Navigation
- **Dashboard entry:** Replace the “Open menu builder” button in `components/admin/admin-workspace.tsx` with a dropdown trigger (Radix `DropdownMenu`). Options:
  1. `Builder studio` → existing `/[lang]/admin/menu`.
  2. `Layout editor` → new `/[lang]/admin/menu/layout`.
- **Route:** Create `app/[lang]/admin/menu/layout/page.tsx`. Guard with `requireActiveAdmin`, load dictionaries (`adminMenu.layoutEditor` namespace) and `getAdminMenuHierarchy()` to hydrate the editor.
- **Breadcrumb / return affordance:** Keep the emerald admin shell header and add a “Back to builder” ghost button pointing to `/[lang]/admin/menu`.

## Data & API Design
### Existing Sources
- `menuCategories.displayOrder` and `menuItems.displayOrder` already exist in `src/db/schema.ts`.
- `getAdminMenuHierarchy()` (`lib/menu/queries.ts`) returns categories sorted by `displayOrder` and each category includes its items. Reuse this for the initial tree.

### New Bulk Reorder Endpoint
- Add `app/api/admin/menu/reorder/route.ts` (POST only, `revalidate = 0`).
- Payload schema (Zod):
  ```ts
  const menuReorderSchema = z.discriminatedUnion("mode", [
    z.object({
      mode: z.literal("categories"),
      categories: z.array(z.object({
        id: z.string().uuid(),
        displayOrder: z.number().int().nonnegative(),
      })).min(2),
    }),
    z.object({
      mode: z.literal("items"),
      categoryId: z.string().uuid(),
      items: z.array(z.object({
        id: z.string().uuid(),
        displayOrder: z.number().int().nonnegative(),
      })).min(2),
    }),
  ]);
  ```
- Handler flow:
  1. `requireActiveAdmin()`.
  2. Neon’s serverless Drizzle client doesn’t expose long-running transactions, so issue batched `db.batch` or sequential `await db.update(...)` calls while short-circuiting on failure (return 500 + log). Keep payload small (<50 rows) so latency stays low.
  3. For `categories`: `for await` loop updating `menuCategories.displayOrder` with `where(eq(menuCategories.id, input.id))`.
  4. For `items`: add `where(and(eq(menuItems.id, id), eq(menuItems.categoryId, categoryId)))` to avoid cross-category leakage.
  5. Return `{ success: true }`.
- Use `db.update(...).set({ displayOrder }).where(...)` (Drizzle) to stay type-safe.
- Optional optimization: accept an optional `version` (max `updatedAt` timestamp) to detect collisions later; log TODO in handler for future concurrent editing support.

### Validation & Business Rules
- Only one mode at a time: the API enforces either “categories” or “items”.
- For items mode, reject payloads when `items[i].id` does not belong to `categoryId`.
- Ignore records whose `displayOrder` hasn’t changed to keep the sequential update loop cheap.
- Return 400 with the first validation issue to keep UI messaging friendly.

## UI / UX Blueprint
### Layout
- Full-width card sitting inside the same neutral background as `AdminMenuManager`.
- Header block: title + helper copy + a `Badge` showing whether we’re editing “Categories” or “Items”.
- Summary row showing count of categories, count of items in the selected category, and a status pill (“No unsaved changes” / “Pending changes”).

### Mode Switcher
- Use a segmented control (two `Button` components acting as toggles) labelled “Categories” and “Items”.
- When switching modes:
  - If there are unsaved changes, present a `Dialog` asking to discard or stay.
  - Reset the reorder list to match the authoritative store when switching (after discard).
- Item mode exposes a `Select` listing all categories (sorted by current order). Selecting a category repopulates the sortable list.

### Reorder List
- Add `@dnd-kit/core` + `@dnd-kit/sortable` for smooth drag handles (small dependency footprint, full TS support).
- Each row shows:
  - Drag handle icon.
  - Category or item name (English primary, Burmese subtitle when present).
  - Availability / status chip (hidden categories, draft items) to give admins context.
  - Current order index number on the right for clarity.
- When the user drags, update a local array and recompute `displayOrder` using array index × 10 to leave padding for future automatic inserts.
- Detect which records have changed order by comparing new index with original; store them in `pendingChanges`.

### Action Bar
- Sticky footer (bottom of card on desktop, full-width on mobile) with:
  - `Reset order` (ghost button) → reverts to initial snapshot for the current mode.
  - Spacer text describing pending operations (e.g., “3 categories will move”).
  - Primary `Apply display order changes` button (`size="lg"`) disabled until `pendingChanges.length > 0`.

### Feedback & Errors
- Use `sonner` toasts: success (“Display order saved”) / error (surface server message and keep local state untouched).
- Inline error banner if the API rejects due to validation or auth (similar style to menu editor guard rails).
- Show skeleton loaders for the reorder list when switching categories or while the initial tree is loading.

## Frontend Architecture
### State Management
- Extend `useAdminMenuStore` with helpers:
  - `setMenuOrder(menu: MenuCategoryRecord[])` (already available via `setMenu`).
  - `getCategoryById` selector for memoized lookups.
  - `updateCategoryOrder(localSortedIds: string[])` and `updateItemOrder(categoryId, localSortedIds)` purely for UI state (does not mutate global store until refresh).
- Inside the layout editor page, keep local `useReducer` state that tracks:
  - `mode: "categories" | "items"`.
  - `selectedCategoryId`.
  - `orderedIds: string[]`.
  - `pendingChanges: Array<{ id: string; displayOrder: number }>` for the active mode only.
  - `isSubmitting` / `error`.
- Local state prevents accidental interference with the main menu builder workspace when both are open in separate tabs.

### Derived Data & Type Safety
- Build a helper `normalizeDisplayOrder(records: { id: string }[])` that returns the `[{ id, displayOrder }]` payload and ensures deterministic ordering.
- Co-locate the Zod schema used by the new API under `lib/menu/validators.ts` as `menuReorderSchema` and import it on the server and client for shared typing (`z.infer`).
- Export a typed client helper from `components/admin/menu/api-client.ts`:
  ```ts
  export async function applyMenuReorder(payload: MenuReorderPayload) { ... }
  ```
  returning `{ success: true }` or throwing.

### Network Strategy
- Fetch the tree once on page load via server component (SSR) to keep TTFB predictable.
- Client-side, only hit `/api/admin/menu/reorder` on apply and `/api/admin/menu/tree` on manual “Refresh data” (secondary ghost button).
- Use `AbortController` to cancel duplicate apply actions if the user double clicks.

## Implementation Phases
1. **Routing & Copy**
   - Create the new page route and update dictionaries (`dictionaries/en/adminMenu.json` etc.) with layout editor strings (title, helper, CTA labels, error copy).
   - Add the dropdown entry point in the dashboard card and reuse for the workspace header if needed.
2. **API & Types**
   - Add Zod schema + TS types for reorder payloads.
   - Implement `/api/admin/menu/reorder` with sequential/batched updates + validation + logging (note the Neon transaction limitation in comments).
   - Unit-test the pure helper that builds update statements (small TS test using `vitest` or inline assertions).
3. **UI Shell & State**
   - Build the layout editor page scaffold (header, stats, mode switcher, category select).
   - Wire local reducer + derived state; render static lists first.
4. **Drag & Apply**
   - Integrate `@dnd-kit` for sortable rows, dirty tracking, and the sticky action bar.
   - Implement `applyMenuReorder()` call, optimistic toasts, and reset logic.
5. **Polish**
   - Empty states (no categories / no items in selected category).
   - Mobile tweaks (stacked action bar, larger touch targets).
   - Accessibility: focus outlines on drag handles, announce reorder via `aria-live`.

## Testing & Verification
- **Manual smoke:**
  1. Reorder categories, click apply, refresh page → new order persists.
  2. Reorder items in category A, switch to category B (should prompt discard).
  3. Attempt to apply without changes → button stays disabled.
  4. Simulate server error (temporarily block API) → ensure error toast and state not mutated.
  5. Try from mobile viewport to confirm drag handles still reachable (fallback to up/down buttons if drag not supported).
- **Lint & type checks:** `npm run lint` plus ensure no TS errors from new shared payload types.
- **Potential follow-up tests:** Add dedicated integration covering `/api/admin/menu/reorder` once test harness exists.

## Open Questions / Follow-Ups
- Do we need audit trails (“who changed what order”)? Not required now, but the API response could include `updatedAt` if we later expose change history.
- Should diners see updates instantly or after manual publish? Current data model is live, so apply immediately; consider adding a “Publish layout” toggle later if needed.
- If concurrent admins reorder at the same time, last write wins. For MVP that’s acceptable; revisit optimistic concurrency if we notice collisions in production logs.
