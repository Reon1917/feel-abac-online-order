# Delivery Location Persistence Plan

## Goal
Persist one preset location choice and one custom Google Maps address per user so cart/menu can preselect without calling Places. Only call Places when the user edits a custom address; preset remains DB-only. Nullable fields allow fresh accounts.

## Schema (done)
- Extend `user_profiles` with:
  - `delivery_selection_mode` (`preset` | `custom` | null) to remember last active mode.
  - `custom_condo_name`, `custom_building_name`, `custom_place_id`.
  - `custom_lat`, `custom_lng` (numeric(10,6)) and `custom_updated_at` for cached coords.
- Keep existing `default_delivery_location_id` / `default_delivery_building_id` nullable for preset.
- Migration: add the columns; no data backfill needed. Neon note: apply with `drizzle-kit push` (no explicit transactions).

## Backend changes
- Update delivery selection types to include persisted custom fields and `delivery_selection_mode`.
- API to save selection:
  - Input: mode, preset IDs or custom fields + placeId + coords.
  - Writes to `user_profiles` using a single `update` (avoid multi-step transactions on Neon).
  - For custom: if coords missing, fetch Place Details (IDs only) once, then persist `custom_lat/lng`.
- Load selection:
  - Read profile; build `DeliverySelection`:
    - If `delivery_selection_mode=preset` and preset IDs present → preset selection.
    - If `delivery_selection_mode=custom` and custom name exists → custom selection with placeId and coords (skip Places call).
    - Fallback: null selection.

## Frontend changes
- Cart/menu picker:
  - On mount, request persisted selection; hydrate mode, preset IDs, and custom fields/placeId/coords.
  - On save, call the new API to persist and close dialog.
  - Only trigger Places autocomplete/Place Details when the user edits custom address text or selects a new prediction.
- Admin: optional “View in Maps” link using placeId/coords helper (for debugging).

## Testing checklist
- New user: no selection → picker defaults to preset tab; saving preset stores IDs.
- Switch to custom: select prediction, save → reopen shows custom, map uses cached coords, no extra Place Details call.
- Switch back to preset: updates mode/IDs, custom values remain stored but inactive.
- Missing coords but placeId present (old data): first load fetches IDs-only details once, then caches.

## Rollout
- Run `npx drizzle-kit push` to apply schema.
- Deploy backend + frontend together; no feature flag needed (columns are nullable).
