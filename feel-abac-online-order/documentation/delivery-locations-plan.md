# Delivery Locations & Buildings Feature

## Goal
Let diners pick a delivery condo (and optional building) from a curated list with fee transparency, while still allowing manual entries. Provide admins with tooling to manage the curated list and keep fees accurate for AU campuses.

## Data Model
- `delivery_locations`
  - `slug`, `condoName`, `area` (default `AU`) uniquely identify a condo.
  - `minFee`/`maxFee` capture the delivery range once per condo; no per-building pricing.
  - `notes` for internal context (e.g., “meet at guard booth”).
  - `isActive` toggles visibility without deleting rows.
  - Indexed by `slug` (unique) and `area` for fast lookup and future multi-area support.
- `delivery_buildings`
  - Optional per-condo children for multi-building complexes (“Building A/B/C”).
  - Cascade delete when the parent location is removed, unique per `(locationId, label)`.
- `user_profiles`
  - Nullable `default_delivery_location_id` and `default_delivery_building_id`.
  - Building FK only meaningful when the matching location FK is set; enforce in app logic.
- Orders/session payloads
  - Store `deliveryLocationId`, optional `deliveryBuildingId`, and boolean `isCustom`.
  - When `isCustom` is true, persist `customCondoName` + `customBuildingLabel` for ops review.

## Business Rules
1. **Admin management**
   - Admins can create/update/deactivate condos.
   - Fee range (`minFee`/`maxFee`) is required and must obey `min <= max`.
   - Buildings are optional; when present they only affect UI filtering, not pricing.
   - Deactivated condos disappear from diner lists but stay in history; deleting cascades buildings.
2. **Diner experience**
   - Location selector lists active condos grouped by `area`.
   - If a condo has buildings, show a second dropdown; otherwise skip the step.
   - Display fee range with localized copy (e.g., “฿20–35 delivery”).
   - Provide “Other condo” escape hatch capturing free-text condo + optional building.
   - Respect and prefill the user’s default location/building when authenticated.
3. **Validation**
   - Diners must choose either `deliveryLocationId` or supply a custom condo name.
   - When `deliveryBuildingId` is populated, ensure it belongs to the selected location.
   - Restrict custom text length (e.g., 100 chars) and trim whitespace to keep payload clean.
4. **Analytics & curation**
   - Log custom entries in a queue so ops can add high-frequency condos to the curated table.
   - Track selection frequency per location to help tune fee bands or prioritize support.

## API & UI Touchpoints
- **Admin UI**
  - New CRUD surface under `app/[lang]/admin/menu` or dedicated “Delivery” section.
  - Form includes condo basics, fee range inputs, and nested repeaters for buildings.
  - Bulk import/export CSV optional for initial seeding.
- **Public flows**
  - Onboarding: require a delivery location (or custom) before unlocking the menu.
  - Menu/cart: expose a “Change delivery location” action that reuses the selector modal.
  - Persist chosen values in the cart/session so totals can include the fee range if needed.
- **API**
  - `GET /api/delivery/locations`: returns active condos with nested buildings (`json_agg`).
  - `POST /api/admin/delivery-locations`: create/update condos; enforce auth + input validation.
  - Extend order submission payload to include the new IDs/custom fields.

## Rollout Steps
1. Generate Drizzle migration for the new tables/columns.
2. Seed baseline AU condos + buildings via script or admin UI.
3. Build admin CRUD (list, detail, buildings repeater).
4. Wire onboarding/menu flows to fetch the delivery catalog and store selections.
5. Backfill existing user profiles with defaults only when they already have saved addresses.
6. Monitor custom-entry logs to keep the curated list fresh.
