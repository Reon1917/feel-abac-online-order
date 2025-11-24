# Bug Report: placeId dropped on reopen

## Summary
Reopening the delivery location picker with an existing custom selection clears the saved `placeId`, so saving without re-selecting a prediction strips the id. This defeats free Place Details caching and forces retyping for map previews.

## Location
- File: components/cart/delivery-location-picker.tsx
- Lines: 100-138 (dialog open effect resets `selectedPlaceId` to null)

## Repro Steps
1. Save a custom delivery location selected from autocomplete (ensures a `placeId` is stored).
2. Reopen the delivery picker (custom tab) without changing the text.
3. Click Save.

## Expected
Previously stored `placeId` stays intact across dialog reopen so subsequent saves and map previews reuse cached/free Place Details lookups.

## Actual
The `useEffect` on dialog open ends with `setSelectedPlaceId(null)`, so `handleSave` serializes the custom selection without `placeId`, dropping the id unless the user re-selects an autocomplete prediction.

## Impact
High: breaks the cost-saving/cache strategy for custom addresses and regresses map preview behavior for already-saved locations.

## Notes
Reset should occur only when no custom selection is present; otherwise keep the stored `placeId` from `selection`.
