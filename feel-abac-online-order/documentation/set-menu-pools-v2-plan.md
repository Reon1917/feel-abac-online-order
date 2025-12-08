# Set Menu Pools v2 – Role‑less, Base vs Add‑on Model

This document outlines how to simplify the set menu pool system so it matches how the kitchen actually thinks about the best‑seller set: **base choices** and **optional add‑ons**, without hard‑coded roles like `base_curry` / `addon_curry` / `addon_veggie`.

The goal is to keep the existing schema and cart logic, but:

- Treat **roles as freeform identifiers / slots**, not food types.
- Make **base vs add‑on** behavior come from flags we already have (`isPriceDetermining`, `isRequired`, `minSelect` / `maxSelect`).
- Let admin naming be fully driven by `labelEn` / `labelMm` and pool names.

We are OK throwing away current set menu + pool config while implementing this (no heavy data migration required).

---

## 1. Current Model (Quick Recap)

### Schema – `setMenuPoolLinks` (src/db/schema.ts)

- `role: text` – currently used for `"base_curry" | "addon_curry" | "addon_veggie"`, but the DB itself does not enforce those values.
- Behavior is driven by:
  - `isPriceDetermining` – when `true`, this link’s options set the **base price**.
  - `isRequired` – whether the pool must have at least one selection.
  - `minSelect`, `maxSelect` – numeric constraints (today only `maxSelect` is enforced in the diner UI).
  - `usesOptionPrice`, `flatPrice` – whether add‑ons use per‑option prices or a fixed THB per selection.
  - `labelEn`, `labelMm` – user‑facing label for that pool link, optional.

### Types & Validators

- `lib/menu/types.ts`
  - `export type SetMenuPoolRole = "base_curry" | "addon_curry" | "addon_veggie";`
  - `SetMenuPoolLinkRecord.role: SetMenuPoolRole`
  - `PublicSetMenuPoolLink.role: SetMenuPoolRole`
- `lib/cart/types.ts`
  - Re‑defines `SetMenuPoolRole` with the same limited union.
- `lib/menu/validators.ts`
  - `SET_MENU_POOL_ROLES = ["base_curry","addon_curry","addon_veggie"]`
  - `setMenuPoolLinkSchema.role` uses `z.enum(SET_MENU_POOL_ROLES)`.

### Admin UI

- `components/admin/menu/menu-editor.tsx`
  - `SET_MENU_ROLE_LABELS` and `SET_MENU_ROLE_DESCRIPTIONS` hard‑wire:
    - `base_curry` → “Base selection · sets price”.
    - `addon_curry` / `addon_veggie` → “Add‑on group 1/2”.
  - `SetMenuPoolsPanel` iterates a fixed ordered list of roles and shows one block per role.
  - `buildDefaultPoolLink` preconfigures:
    - Base: required, `minSelect = 1`, `maxSelect = 1`, `isPriceDetermining = true`.
    - Add‑ons: optional, `minSelect = 0`, `maxSelect = 3`, `isPriceDetermining = false`.
- Choice groups (`ChoiceGroupPanel`) are legacy; they do **not** drive the diner set menu UI, and are now hidden when `isSetMenu` is true.

### Diner UI

- `components/menu/set-menu-builder.tsx`
  - Only cares about:
    - `isPriceDetermining` – which selections affect `basePrice`.
    - `isRequired` + `maxSelect` – required vs optional + upper bound.
    - `usesOptionPrice` / `flatPrice` + per‑option `price`.
  - Does **not** special‑case `role` beyond showing labels.
  - Currently ignores `minSelect` in validation.

---

## 2. Target Model – Base vs Add‑on, Role as Free String

We want:

- Any number of pool links per set menu item.
- Each link can be:
  - A **base pool** (required, sets base price), or
  - An **add‑on pool** (optional, can be free or paid).
- The “type” of pool is defined by flags:
  - **Base pool**:
    - `isPriceDetermining = true`
    - `isRequired = true`
    - `minSelect >= 1`, `maxSelect >= minSelect`
  - **Add‑on pool**:
    - `isPriceDetermining = false`
    - `isRequired = false`
    - `minSelect = 0`, `maxSelect >= 1`
- Naming:
  - Admin defines pool names (`choicePools.nameEn/nameMm`) and per‑link labels (`labelEn/labelMm`).
  - Roles are **not** food‑type strings; they’re internal identifiers (or even optional).

We do **not** need to change the DB schema to get there.

---

## 3. Implementation Plan (Phased)

### Phase 0 – Cleanup & Guardrails (Small)

**Goal:** Make the current UI less misleading while we refactor.

- [x] Hide legacy `ChoiceGroupPanel` when `isSetMenu` is true:
  - Already implemented: Step 3 now shows `SetMenuPoolsPanel` and only shows choice groups for non‑set‑menu items.
- [ ] Manually clear existing set‑menu pool links in the admin for the best‑seller:
  - Either via the current Set menu pools UI or a one‑time DB cleanup.
  - This avoids having to migrate old role strings; we’ll just re‑create correct pools after v2 is in.

**Effort:** XS (UI logic done), plus a small manual cleanup.

---

### Phase 1 – Relax Role Typing (Backend + Types) (Small/Medium)

**Goal:** Stop treating roles as a fixed enum; treat them as free strings (or even optional) while keeping existing data valid.

1. **Types:**
   - In `lib/menu/types.ts`:
     - Change `SetMenuPoolRole` from a union to a free string:
       - `export type SetMenuPoolRole = string;`
   - In `lib/cart/types.ts`:
     - Import `SetMenuPoolRole` from `@/lib/menu/pool-types` (already done) and keep it as `string`.

2. **Validators:**
   - In `lib/menu/validators.ts`:
     - Remove `SET_MENU_POOL_ROLES` usage from the set‑menu link schema; keep the constant only if other code relies on it.
     - Replace:
       - `const setMenuPoolRoleEnum = z.enum(SET_MENU_POOL_ROLES);`
       - `role: setMenuPoolRoleEnum,`
     - With:
       - `role: z.string().trim().min(1, "Role is required"),`
     - Optionally constrain max length (e.g., 40 chars) to keep it neat.

3. **Pool queries & public mapping:**
   - `lib/menu/pool-queries.ts` and `lib/menu/queries.ts` already treat `role` as a string; no behavior change needed.
   - `getPublicMenuItemById` just passes the role through; changing its type to `string` is enough.

**Impact / risk:**

- Existing data with `base_curry` / `addon_curry` / `addon_veggie` will still validate (they’re just strings).
- TypeScript becomes more permissive; it’s on the UI to guide admins into “base vs add‑on” instead of specific role literals.

**Effort:** S–M (type churn, but localized).

---

### Phase 2 – Admin UI: Set Menu Pools Panel (Medium)

**Goal:** Make the admin experience match the mental model: “Base” vs “Add‑ons”, not “curry vs veggie”.

1. **Update copy to generic language:**
   - In `components/admin/menu/menu-editor.tsx`:
     - Replace `SET_MENU_ROLE_LABELS` / `SET_MENU_ROLE_DESCRIPTIONS` with generic copy:
       - e.g., `Base selection`, `Add‑on group A`, `Add‑on group B`.
     - Move food‑specific labeling into `labelEn/labelMm` (admin‑editable).

2. **Use labels as primary customer‑facing name:**

   - In `SetMenuPoolsPanel`:
     - Keep showing the fixed three slots for now, but:
       - Emphasize the `Attached pool` select + a `Link label` text input that writes into `labelEn` / `labelMm`.
       - Make it clear in helper text that this label is what diners will see (over the pool’s raw name).

3. **Introduce explicit “Base vs Add‑on” toggle:**

   - For each link row in `SetMenuPoolsPanel`, add a simple toggle:
     - Options:
       - `Base (sets price)` – flips:
         - `isPriceDetermining = true`
         - `isRequired = true`
         - `minSelect = 1` (and `maxSelect >= 1`).
       - `Add‑on` – flips:
         - `isPriceDetermining = false`
         - `isRequired = false`
         - `minSelect = 0`.
   - This makes the behavior explicit and removes the need to think about role strings.

4. **(Optional for now) Allow more rows later:**

   - Keep the internal structure as “three configured slots”, but shape the UI so it could be iterated over an array of links later (we can add dynamic add/remove rows in a Phase 3 without rewriting everything).

**Effort:** M (UI work, but contained to one component).

---

### Phase 3 – Diner UI: Surface Base vs Add‑on Clearly (Small/Medium)

**Goal:** Align what diners see with the base/add‑on distinction.

1. **Base vs add‑on badges:**
   - In `components/menu/set-menu-builder.tsx` / `PoolSection`:
     - Derive a `variant`:
       - Base if `link.isPriceDetermining === true`.
       - Add‑on otherwise.
     - Adjust the helper text:
       - Base: “Required · Sets base price”.
       - Add‑on: “Optional” or “Optional · Up to N”.

2. **(Optional) Enforce `minSelect` for better UX:**

   - Today we only enforce `isRequired` + `maxSelect`.
   - For “nice to have”:
     - If `isRequired` and `minSelect > 0`, show a more specific error like:
       - “Pick at least 2” instead of a generic “Please complete all required selections”.
     - We can start by just improving error copy without hard‑failing if `minSelect` is not met (to avoid surprising existing setups).

**Effort:** S–M (UI tweaks, no schema changes).

---

### Phase 4 – (Optional) Fully Dynamic Roles (Medium/Large)

**Goal:** Move beyond the 3 preset slots and let admin attach any number of pools to a set item.

1. **Dynamic array instead of fixed roles:**
   - In `SetMenuPoolsPanel`:
     - Replace the fixed `SET_MENU_POOL_ROLES.map(...)` with:
       - An array of link rows derived from `form.watch("poolLinks")`.
       - “Add pool link” / “Remove” buttons to manage rows.
   - Role field:
     - Becomes a hidden/internal string (e.g., a slug or ID), or even something we auto‑derive from the label.
     - Admin doesn’t need to see or type the role.

2. **Constraints:**
   - Validate at save time (in `setMenuPoolLinksArraySchema` or menu item update path) that:
     - At most one link has `isPriceDetermining = true`.
     - Base link(s) respect `minSelect >= 1`.

3. **Migration:**
   - Because we’re OK re‑configuring the current set menu from scratch, we can:
     - Treat existing links as “seed data”, or simply delete them before enabling the new UI.
     - No complex DB migration script required.

**Effort:** M–L (bigger UI change, but unlocks future flexibility).

---

## 4. Recommended Path for the Best‑Seller Set

Given we only have one high‑stakes item (the best‑seller set) and we’re OK re‑adding config:

1. **Now:**
   - Keep Phase 0 + 1 + 2 as the focus.
   - Re‑configure the best‑seller set menu using:
     - One base pool link (required, price‑determining).
     - One add‑on pool link for paid extras.
     - One add‑on pool link for free veggies (options priced at 0).
   - Use `labelEn/labelMm` for customer‑facing copy (“Base curry”, “Free veggies”, “Extra mains”).

2. **Later:**
   - If you need more than 3 add‑on groups per item, invest in Phase 4 to go fully dynamic.
   - If you want stricter validation (e.g., min picks), extend the SetMenuBuilder validation as described in Phase 3.

This keeps the codebase aligned with the way the kitchen thinks—**base vs add‑on**—without fighting the existing schema, and leaves a clean path to generalize when you’re ready.***
