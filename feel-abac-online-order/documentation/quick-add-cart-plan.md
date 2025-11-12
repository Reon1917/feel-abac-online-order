# Quick Add Cart Migration Plan

## Objectives
- Remove the deferred “pending additions” queue in favor of committing each tap directly to `/api/cart`.
- Keep the floating `+1` animation for instant feedback while dropping the bulk apply step.
- Gate the quick-add button so it only fires for items without choice groups; other items should open the detail page to collect required options.
- Simplify dictionary copy, state management, and documentation to reflect the single-add workflow.

## Current Surface Areas To Replace
- **API**: `app/api/cart/bulk/route.ts` and any `fetch("/api/cart/bulk")` callers.
- **Context & UI**: `components/menu/cart-draft-provider.tsx`, `useCartDraft`, and `CartPeekButton`’s pending UI.
- **Menu surfaces**: desktop `components/menu/menu-browser.tsx` and mobile `components/menu/mobile/mobile-menu-browser.tsx` rely on the provider’s `queueAddition`.
- **Copy**: `dictionaries/*/menu.json` contains `cartPeek.apply*`, `pendingLabel`, and `cartToasts.*` strings that no longer apply.

## Implementation Steps

### Phase 1 – API Cleanup
1. **Delete `/api/cart/bulk` route**  
   - Remove `app/api/cart/bulk/route.ts` and its directory. The singular `POST /api/cart` already accepts `{ menuItemId, quantity, selections, note }`.
   - Confirm nothing else imports `addItemsToCart` directly from client code; the helper can stay server-side because detail pages may still batch options internally.
2. **Update docs**  
   - Mention in `documentation/menu-system-plan.md` (or related doc) that cart writes happen through the single-item endpoint only.

### Phase 2 – Quick-Add Hook & Animation
1. **New client hook**  
   - Create `components/menu/use-quick-add.ts` exporting `useQuickAddToCart({ requireDetailsMessage, successMessage, errorMessage })`.
   - Responsibilities:
     - Accept `PublicMenuItem` + optional `DOMRect`.
     - If `item.choiceGroups.length > 0`, surface `requireDetailsMessage` via `toast.info` and return `false`.
     - Otherwise call `fetch("/api/cart", { method: "POST", body: JSON.stringify({ menuItemId: item.id, quantity: 1, selections: [], note: null }) })`.
     - On success trigger `router.refresh()` and an animation callback.
     - On failure, show `toast.error`.
2. **Floating particle overlay**  
   - Extract `FloatingParticles` logic from `cart-draft-provider.tsx` into a standalone `components/menu/cart-add-animation.tsx`. Provide imperative `launch(rect)` method via hook state so desktop/mobile can reuse it without context.

### Phase 3 – Responsive Browser Refactor
1. **Remove `CartDraftProvider`**  
   - Delete `components/menu/cart-draft-provider.tsx`. Replace with the hook + animation overlay inside `ResponsiveMenuBrowser`.
   - `ResponsiveMenuBrowser` should:
     - Initialize `const { launchParticle, QuickAddOverlay } = useCartAddAnimation()`.
     - Pass `onQuickAdd={(item, rect) => quickAdd(item, rect ?? null)}` into both browsers.
     - Render `<QuickAddOverlay />` near the root.
2. **Desktop browser updates (`components/menu/menu-browser.tsx`)**
   - Drop `useCartDraft`.
   - Receive an `onQuickAdd` prop from `ResponsiveMenuBrowser` and wire it to `MenuCategorySection`, `MenuItemCard`, and `MenuItemRow`.
   - When a user clicks `+`, call `onQuickAdd(item, rect)`—the hook already handles ability checks, so remove duplicated `canQuickAdd` gating in favor of `passesQuickAddGuard = quickAdd.canHandle(item)`. Keep the disabled state (no choices/out of stock) for UX clarity.
3. **Mobile browser updates (`components/menu/mobile/mobile-menu-browser.tsx`)**
   - Same as desktop: accept `onQuickAdd`, remove context usage, and rely on the hook for side effects.
   - When `quickAdd` rejects (choices present), use `router.push(withLocalePath(...))` so the user lands on the detail view automatically.

### Phase 4 – Cart Peek Button Simplification
1. **Remove pending UI**  
   - Update `components/menu/cart-peek-button.tsx` to only show the cart summary button when `summary?.totalQuantity > 0`.
   - Delete props/states tied to pending items (`pendingItems`, `applyPendingAdditions`, duplicate buttons).
2. **Dictionary updates**  
   - Prune `cartPeek.applyButton`, `applyProcessing`, `pendingLabel`, and `cartToasts.*` from every locale file (`dictionaries/en/menu.json`, `dictionaries/my/menu.json`, etc.).
   - Add optional `quickAdd` copy (e.g., `"added": "Added to cart"`, `"failed": "Can't add right now"`), referenced by the new hook for toasts.

### Phase 5 – Routing & Access Patterns
1. **Detail redirect for configurable items**
   - In the quick-add hook, when `item.choiceGroups.length > 0`, return `{ needsDetail: true }`. Callers should `router.push(detailHref)` to force configuration instead of silently failing.
   - Ensure this branch runs on both desktop and mobile so the behavior matches the product decision.
2. **Quantity stacking**
   - Subsequent taps re-use the same hook, so each call posts `{ quantity: 1 }`. No extra state is needed; server merges quantities per `addItemToCart`.

### Phase 6 – QA & Cleanup
1. **Remove dead imports**  
   - Delete any leftover `cartToasts` references and unused CSS tied to the pending button.
2. **Manual validation**
   - Scenarios to verify:
     - Quick add + animation increments quantity on both desktop and mobile.
     - Items with choices always open `/menu/items/[itemId]`.
     - Cart peek badge updates after `router.refresh()`.
     - Error toast appears when API rejects (e.g., out-of-stock).
3. **Documentation**
   - Update onboarding docs (`documentation/menu-system-plan.md`, `documentation/menu-layout-editor-plan.md` if needed) to describe the simplified add-to-cart workflow and lack of batching.

## Files To Remove Or Heavily Refactor
- **Delete**: `app/api/cart/bulk/route.ts`, entire `components/menu/cart-draft-provider.tsx` file, pending-specific copy blocks in `dictionaries/*/menu.json`.
- **Refactor**: `components/menu/responsive-menu-browser.tsx`, `components/menu/menu-browser.tsx`, `components/menu/mobile/mobile-menu-browser.tsx`, `components/menu/cart-peek-button.tsx`, any CSS modules referencing the old pending button.
- **Add**: `components/menu/use-quick-add.ts` (or similarly named hook) and `components/menu/cart-add-animation.tsx` (or reuse existing particle markup) to encapsulate the new behavior.

## Efficiency Considerations
- Reuse existing server helpers (`addItemToCart`) so no new SQL/Drizzle work is required.
- Keep the animation component purely client-side with minimal state to avoid re-renders elsewhere.
- Centralizing fetch/toast logic inside the hook prevents duplicated error handling between desktop and mobile surfaces.
- Removing the context/provider eliminates extra React renders; components now receive a stable callback prop.
