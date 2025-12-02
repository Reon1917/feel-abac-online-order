# Map Implementation (Delivery Preview)

## Role in the System
- Gives diners a visual preview of where preset delivery locations are on campus.
- Lives inside the delivery location picker dialog and uses cached coordinates to avoid repeated Google Places calls.

## Core Pieces

- **`components/map/delivery-location-map.tsx`**
  - Wraps Google Maps via `@react-google-maps/api`.
  - Accepts a `DeliveryLocationOption | null` and renders:
    - Centered map with marker when coordinates are available.
    - Default ABAC-area map when only a slug is known.
    - Skeleton/placeholder states when loading, misconfigured, or no location selected.
  - Uses `NEXT_PUBLIC_GOOGLE_MAPS_KEY` and `useJsApiLoader` with:
    - `disableDefaultUI: true`, `clickableIcons: false`, `gestureHandling: "greedy"`.

- **`lib/delivery/location-coordinates.ts`**
  - Maps delivery location slugs to `lat`/`lng`.
  - Provides a default ABAC coordinate and a helper to look up coordinates with a safe fallback.

- **`components/cart/delivery-location-picker.tsx`**
  - Hosts the map inside the picker when a preset location is selected.
  - Shows the map only for presets; custom locations rely on free-text and persisted `placeId` + cached coordinates.

## Implementation Notes
- Map is strictly a convenience preview; orders always store either `deliveryLocationId`/`deliveryBuildingId` or the persisted custom address payload from `user_profiles`.
- If the Google Maps key is missing or the script fails to load, the UI falls back to an animated placeholder and logs a warning in dev.

