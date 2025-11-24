type MapsLinkInput =
  | { placeId: string; coordinates?: { lat: number; lng: number } | null }
  | { placeId?: null; coordinates: { lat: number; lng: number } };

export function buildGoogleMapsLink(input: MapsLinkInput): string | null {
  if ("placeId" in input && input.placeId) {
    return `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(
      input.placeId
    )}`;
  }

  if ("coordinates" in input && input.coordinates) {
    const { lat, lng } = input.coordinates;
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  return null;
}
