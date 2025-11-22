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

export function getLocationCoordinates(
  location: DeliveryLocationOption | null
): LatLngPoint | null {
  if (!location) {
    return null;
  }

  return LOCATION_COORDINATES[location.slug] ?? null;
}

export { DEFAULT_LOCATION_COORDINATE };
