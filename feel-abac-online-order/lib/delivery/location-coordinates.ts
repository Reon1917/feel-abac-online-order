import type { DeliveryLocationOption } from "@/lib/delivery/types";

export type LatLngPoint = {
  lat: number;
  lng: number;
};

const DEFAULT_LOCATION_COORDINATE: LatLngPoint = {
  lat: 13.672649,
  lng: 100.629021,
};

const LOCATION_COORDINATES: Record<string, LatLngPoint> = {
  // Example: "abac-condo": { lat: 13.672649, lng: 100.629021 },
};

// GeoJSON polygon defining university area bounds
const UNIVERSITY_AREA_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        coordinates: [
          [
            [100.7976025622728, 13.634483087157292],
            [100.7976025622728, 13.572482594045354],
            [100.87421991920809, 13.572482594045354],
            [100.87421991920809, 13.634483087157292],
            [100.7976025622728, 13.634483087157292],
          ],
        ],
        type: "Polygon",
      },
    },
  ],
} as const;

/**
 * Extracts bounding box from GeoJSON polygon and converts to Google Maps LatLngBounds.
 * Returns null if Google Maps API is not loaded or GeoJSON is invalid.
 * 
 * The returned LatLngBounds can be used with locationBias or locationRestriction
 * parameters (non-deprecated) in Google Maps Places API calls.
 */
export function getUniversityAreaBounds(): google.maps.LatLngBounds | null {
  if (typeof window === "undefined" || typeof google === "undefined" || !google.maps?.LatLngBounds) {
    return null;
  }

  try {
    const polygon = UNIVERSITY_AREA_GEOJSON.features[0]?.geometry;
    if (!polygon || polygon.type !== "Polygon") {
      return null;
    }

    const coordinates = polygon.coordinates[0];
    if (!coordinates || coordinates.length < 4) {
      return null;
    }

    // Extract all lng/lat pairs and find min/max
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    for (const [lng, lat] of coordinates) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }

    return new google.maps.LatLngBounds(
      new google.maps.LatLng(minLat, minLng), // Southwest corner
      new google.maps.LatLng(maxLat, maxLng)  // Northeast corner
    );
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Failed to create university area bounds:", error);
    }
    return null;
  }
}

export function getLocationCoordinates(
  location: DeliveryLocationOption | null
): LatLngPoint | null {
  if (!location) {
    return null;
  }

  return LOCATION_COORDINATES[location.slug] ?? null;
}

/**
 * Converts LatLngBounds to NEW Places API rectangle format for locationRestriction
 */
export function boundsToRectangle(
  bounds: google.maps.LatLngBounds
): {
  rectangle: {
    low: { latitude: number; longitude: number };
    high: { latitude: number; longitude: number };
  };
} {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();

  return {
    rectangle: {
      low: {
        latitude: sw.lat(),
        longitude: sw.lng(),
      },
      high: {
        latitude: ne.lat(),
        longitude: ne.lng(),
      },
    },
  };
}

/**
 * Converts GeoJSON bounds directly to NEW Places API rectangle format
 * Useful when Google Maps API is not loaded yet
 */
export function getUniversityAreaRectangle(): {
  rectangle: {
    low: { latitude: number; longitude: number };
    high: { latitude: number; longitude: number };
  };
} | null {
  try {
    const polygon = UNIVERSITY_AREA_GEOJSON.features[0]?.geometry;
    if (!polygon || polygon.type !== "Polygon") {
      return null;
    }

    const coordinates = polygon.coordinates[0];
    if (!coordinates || coordinates.length < 4) {
      return null;
    }

    // Extract all lng/lat pairs and find min/max
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    for (const [lng, lat] of coordinates) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }

    return {
      rectangle: {
        low: {
          latitude: minLat,
          longitude: minLng,
        },
        high: {
          latitude: maxLat,
          longitude: maxLng,
        },
      },
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Failed to create university area rectangle:", error);
    }
    return null;
  }
}

export { DEFAULT_LOCATION_COORDINATE };
