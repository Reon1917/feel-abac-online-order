# Map Implementation - Quick Reference

## TL;DR

The app uses **Google Maps** via `@react-google-maps/api` to show delivery location previews.

## Key Files

| File | Purpose |
|------|---------|
| `components/map/delivery-location-map.tsx` | Main map component |
| `lib/delivery/location-coordinates.ts` | Coordinate storage (hardcoded) |
| `components/cart/delivery-location-picker.tsx` | Uses map component |

## Setup (3 Steps)

1. Get Google Maps API key from [Google Cloud Console](https://console.cloud.google.com/)
2. Add to `.env.local`:
   ```bash
   NEXT_PUBLIC_GOOGLE_MAPS_KEY=your_key_here
   ```
3. Restart dev server

## How It Works

```
User picks location → Map loads → Shows Google Map with marker
                              ↓
                    No API key? → Shows placeholder
```

## Component Usage

```tsx
import { DeliveryLocationMap } from "@/components/map/delivery-location-map";

<DeliveryLocationMap 
  location={selectedLocation}  // DeliveryLocationOption | null
  className="custom-class"     // optional
/>
```

## Map States

- ✅ **With marker**: Location has coordinates → shows pin at exact spot
- 📍 **Without marker**: No coordinates → shows emerald dot at default location
- 🔄 **Loading**: Animated placeholder while map loads
- ❌ **Error**: Animated placeholder if load fails or no API key

## Adding New Location Coordinates

Currently hardcoded. Edit `lib/delivery/location-coordinates.ts`:

```typescript
const LOCATION_COORDINATES: Record<string, LatLngPoint> = {
  "abac-condo": { lat: 13.672649, lng: 100.629021 },
  "new-location-slug": { lat: 13.123456, lng: 100.123456 },  // Add here
};
```

## Map Configuration

- **Zoom**: 16 (with marker) or 13 (default)
- **Size**: 192px height (h-48), full width
- **Controls**: All disabled (minimal UI)
- **Interaction**: Pan enabled, "greedy" gestures

## Package

```json
"@react-google-maps/api": "^2.20.7"
```

## Need More Details?

See full documentation: [`documentation/map-implementation.md`](./map-implementation.md)
