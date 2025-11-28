# Map Implementation in Feel ABAC Online Order

## Overview

The web app uses **Google Maps** to display delivery location previews when users select a condo/building for their order. The map implementation is built using the `@react-google-maps/api` library and integrates with the delivery location selection system.

## Architecture

### Core Components

#### 1. **DeliveryLocationMap Component**
**Location:** `components/map/delivery-location-map.tsx`

This is the main map component that renders an interactive Google Map preview for delivery locations.

**Key Features:**
- Displays a Google Map centered on the selected delivery location
- Shows a marker when specific coordinates are available
- Provides graceful fallback UI when:
  - API key is missing
  - Map fails to load
  - No location is selected
  - Map is still loading
- Uses animated placeholder during loading states

**Props:**
```typescript
type DeliveryLocationMapProps = {
  location: DeliveryLocationOption | null;
  className?: string;
};
```

**Implementation Details:**
- Uses `useJsApiLoader` hook from `@react-google-maps/api` to load Google Maps JavaScript API
- API key is configured via `NEXT_PUBLIC_GOOGLE_MAPS_KEY` environment variable
- Map configuration:
  - Zoom level: 16 (when marker present) or 13 (default location)
  - Disabled UI controls (default UI, clickable icons, map type, street view, fullscreen)
  - Enabled dragging with "greedy" gesture handling
  - Prevents Google Fonts loading for performance
- Container size: 48 units height (h-48), full width, with rounded corners and border

#### 2. **Location Coordinates System**
**Location:** `lib/delivery/location-coordinates.ts`

This module manages the mapping between delivery location slugs and their GPS coordinates.

**Structure:**
```typescript
type LatLngPoint = {
  lat: number;  // Latitude
  lng: number;  // Longitude
};

const DEFAULT_LOCATION_COORDINATE: LatLngPoint = {
  lat: 13.672649,   // Default location (ABAC area)
  lng: 100.629021,
};

const LOCATION_COORDINATES: Record<string, LatLngPoint> = {
  // Maps location slugs to coordinates
  // Example: "abac-condo": { lat: 13.672649, lng: 100.629021 }
};
```

**Functions:**
- `getLocationCoordinates(location)`: Returns coordinates for a given location slug, or null if not found
- Falls back to `DEFAULT_LOCATION_COORDINATE` when no specific coordinates are available

#### 3. **DeliveryLocationPicker Integration**
**Location:** `components/cart/delivery-location-picker.tsx`

The map is embedded within the delivery location picker dialog, appearing when users select a preset location (line 312):

```tsx
<DeliveryLocationMap location={activeLocation} />
```

**Context:**
- Map appears in the "Saved" tab when a preset location is selected
- Shows visual preview of where the delivery location is
- Updates dynamically as user changes location selection
- Not shown for custom locations (only for preset locations)

## Google Maps API Integration

### Library Used
**Package:** `@react-google-maps/api` (version 2.20.7)

**Key Components Used:**
- `useJsApiLoader`: Hook to load Google Maps JavaScript API
- `GoogleMap`: Map container component
- `MarkerF`: Marker component (functional version)

### Configuration

#### Environment Variable
```bash
NEXT_PUBLIC_GOOGLE_MAPS_KEY=your_google_maps_api_key_here
```

**Note:** The `NEXT_PUBLIC_` prefix makes it available in the browser.

#### Map Options
```typescript
{
  disableDefaultUI: true,      // Hides all default controls
  clickableIcons: false,        // Disables POI clicks
  draggable: true,              // Allows map panning
  gestureHandling: "greedy",    // One-finger pan/zoom
  mapTypeControl: false,        // No map/satellite toggle
  streetViewControl: false,     // No street view
  fullscreenControl: false,     // No fullscreen button
}
```

### Loading Strategy
```typescript
const { isLoaded, loadError } = useJsApiLoader({
  id: "delivery-location-map",
  googleMapsApiKey: apiKey,
  preventGoogleFontsLoading: true,
});
```

- Single instance ID prevents multiple map loads
- Google Fonts loading disabled for better performance
- Error handling for failed loads

## Visual States

### 1. **Active Map with Marker**
When a location with coordinates is selected:
- Map centered at location coordinates
- Red marker (MarkerF) at exact location
- Zoom level: 16 (detailed view)
- Full interactivity enabled (pan, zoom)

### 2. **Active Map without Marker**
When a location is selected but no coordinates are available:
- Map centered at default location (ABAC area)
- Custom emerald dot indicator in center (no actual marker)
- Zoom level: 13 (wider area view)
- Visual: "rounded emerald-500 dot with white border and glow shadow"

### 3. **Placeholder States**
The app shows animated placeholders in these scenarios:

#### Map Unavailable
- No API key configured
- Map load error occurred
- Shows: Animated gradient background with border outline
- Dev mode: Console warning about missing API key

#### Loading
- Map JavaScript API is loading
- Shows: Same animated placeholder with "Loading map preview" label

#### No Location Selected
- User hasn't selected a delivery location yet
- Shows: Animated placeholder with "Select a delivery location to preview the map"

### Placeholder Design
```typescript
// Animated radial gradient background
bg-[radial-gradient(circle_at_top,#ffffff,#e2e8f0)]
// Pulsing animation
animate-pulse
// Decorative rounded border
border border-white/60
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Action                              │
│                   (Selects location in dropdown)                 │
└────────────────────────────┬─────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              DeliveryLocationPicker Component                    │
│         (Updates activeLocation state with selection)            │
└────────────────────────────┬─────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              Pass location prop to map component                 │
│    <DeliveryLocationMap location={activeLocation} />            │
└────────────────────────────┬─────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              DeliveryLocationMap Component                       │
│        Calls: getLocationCoordinates(location)                   │
└────────────────────────────┬─────────────────────────────────────┘
                             ↓
                    ┌────────┴────────┐
                    ↓                 ↓
        ┌───────────────────┐  ┌──────────────────┐
        │  Coordinates      │  │  No coordinates  │
        │  Found in map     │  │  (returns null)  │
        └────────┬──────────┘  └────────┬─────────┘
                 ↓                       ↓
    ┌────────────────────────┐  ┌──────────────────────┐
    │  Center at coordinates │  │  Center at default   │
    │  Zoom: 16              │  │  Zoom: 13            │
    │  Show MarkerF          │  │  Show emerald dot    │
    └────────────────────────┘  └──────────────────────┘
                 ↓                       ↓
        ┌────────────────────────────────────────┐
        │   Interactive Google Map Displayed     │
        │   (or placeholder if error/loading)    │
        └────────────────────────────────────────┘
```

### State Handling

```
┌──────────────────────────────────────────────────────────────────┐
│                  DeliveryLocationMap States                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. API Key Missing          → Show "unavailable" placeholder    │
│  2. Map Loading              → Show "loading" placeholder        │
│  3. Map Load Error           → Show "unavailable" placeholder    │
│  4. No Location Selected     → Show "select location" placeholder│
│  5. Location Without Coords  → Show map + emerald dot           │
│  6. Location With Coords     → Show map + marker at coords      │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

## Admin Management

Administrators can manage delivery locations through the admin interface (`components/admin/delivery/location-form.tsx`), which includes:
- Creating new delivery locations with condo name
- Setting delivery fee ranges (min/max)
- Adding optional building names
- Adding location notes
- Managing active/inactive status

**Note:** Currently, location coordinates are hardcoded in `LOCATION_COORDINATES` object and need to be manually added to the code. This could be enhanced in the future to allow admins to set coordinates through the UI.

## Technical Considerations

### Performance
- Google Fonts loading disabled to reduce external requests
- Single map instance ID prevents duplicate loads
- Lazy loading of map via `useJsApiLoader`
- Placeholder shown during load for better UX

### Accessibility
- Placeholder includes `role="img"` and `aria-label` for screen readers
- Map container has proper semantic structure
- Keyboard-accessible controls enabled

### Error Handling
- Graceful fallback when API key missing
- Error state shown when map fails to load
- Console warnings in development mode only
- No breaking errors; always shows some UI

### Styling
- Responsive design with full width
- Consistent with app's design system (Tailwind CSS)
- Rounded corners (rounded-2xl) matching other components
- Emerald color scheme for emphasis
- Height: 12rem (48 units) for consistent sizing

## Future Enhancement Opportunities

1. **Coordinate Management**
   - Add UI in admin panel to set GPS coordinates
   - Store coordinates in database instead of hardcoded object
   - Drag-and-drop marker to set location

2. **Advanced Features**
   - Drawing delivery zones/areas on map
   - Multiple delivery locations on single map
   - Distance calculation from restaurant to location
   - Route visualization for deliveries

3. **Map Providers**
   - Consider alternative map providers (Mapbox, Leaflet + OpenStreetMap)
   - Cost optimization if Google Maps usage increases

4. **User Interaction**
   - Allow users to fine-tune delivery pin location
   - Show estimated delivery time based on location
   - Real-time delivery tracking on map

## Dependencies

```json
{
  "@react-google-maps/api": "^2.20.7"
}
```

The library also installs these peer dependencies:
- `@react-google-maps/infobox`
- `@react-google-maps/marker-clusterer`

## Environment Setup

To enable maps in your development/production environment:

1. Get a Google Maps API key from [Google Cloud Console](https://console.cloud.google.com/)
2. Enable these APIs:
   - Maps JavaScript API
   - (Optional) Geocoding API for address lookups
3. Add to your `.env.local`:
   ```bash
   NEXT_PUBLIC_GOOGLE_MAPS_KEY=your_api_key_here
   ```
4. Restart development server

Without the API key, the map will show a placeholder instead of breaking the app.

## Summary

The map implementation in this web app is a well-architected, user-friendly system that:
- Uses Google Maps for familiar, reliable mapping
- Provides clear visual previews of delivery locations
- Handles errors gracefully with fallbacks
- Integrates seamlessly with the delivery location selection flow
- Maintains good performance with lazy loading
- Follows React and Next.js best practices

The implementation is production-ready while leaving room for future enhancements like admin-managed coordinates and more interactive features.
