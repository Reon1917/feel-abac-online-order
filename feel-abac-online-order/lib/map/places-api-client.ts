"use client";

/**
 * NEW Places API REST Client
 * Migrated from JavaScript SDK to REST endpoints for better cost optimization
 */

const PLACES_API_BASE = "https://places.googleapis.com/v1";

export type PlacePrediction = {
  placeId: string;
  text: {
    text: string;
  };
  structuredFormat?: {
    mainText: {
      text: string;
    };
    secondaryText?: {
      text: string;
    };
  };
};

export type AutocompleteResponse = {
  suggestions: Array<{
    placePrediction?: PlacePrediction;
    queryPrediction?: {
      text: {
        text: string;
      };
    };
  }>;
};

export type PlaceDetailsResponse = {
  id: string;
  displayName?: {
    text: string;
  };
  formattedAddress?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
};

export type AutocompleteOptions = {
  input: string;
  locationRestriction?: {
    rectangle: {
      low: { latitude: number; longitude: number };
      high: { latitude: number; longitude: number };
    };
  };
  includedPrimaryTypes?: string[];
  sessionToken?: string;
  languageCode?: string;
};

/**
 * Convert SDK-style AutocompletePrediction to our PlacePrediction format
 */
export function convertToSdkPrediction(prediction: PlacePrediction): {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text?: string;
  };
} {
  return {
    place_id: prediction.placeId,
    description: prediction.text.text,
    structured_formatting: prediction.structuredFormat
      ? {
          main_text: prediction.structuredFormat.mainText.text,
          secondary_text: prediction.structuredFormat.secondaryText?.text,
        }
      : undefined,
  };
}

/**
 * Autocomplete (New) - POST /places:autocomplete
 * Returns place predictions based on input text
 */
export async function autocompleteNew(
  options: AutocompleteOptions
): Promise<AutocompleteResponse> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_KEY is not set");
  }

  const requestBody: Record<string, unknown> = {
    input: options.input,
  };

  if (options.locationRestriction) {
    requestBody.locationRestriction = options.locationRestriction;
  }

  if (options.includedPrimaryTypes) {
    requestBody.includedPrimaryTypes = options.includedPrimaryTypes;
  }

  if (options.sessionToken) {
    requestBody.sessionToken = options.sessionToken;
  }

  if (options.languageCode) {
    requestBody.languageCode = options.languageCode;
  }

  // Request only needed fields to reduce response size
  const fieldMask =
    "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat";

  const response = await fetch(`${PLACES_API_BASE}/places:autocomplete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Places API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Place Details (New) - GET /places/{placeId}
 * Returns detailed information about a place
 */
export async function placeDetailsNew(
  placeId: string,
  fields: string[] = ["geometry"]
): Promise<PlaceDetailsResponse> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_KEY is not set");
  }

  const fieldMask = fields.join(",");

  const response = await fetch(`${PLACES_API_BASE}/places/${placeId}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Places API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Place Details Essentials (IDs Only) - FREE endpoint
 * Returns only basic place information including coordinates
 * Use this when you already have placeId from autocomplete
 * 
 * Note: According to pricing, "Place Details Essentials (IDs Only)" is FREE/Unlimited
 * This endpoint requests minimal fields to qualify for the FREE tier
 */
export async function placeDetailsIdsOnly(
  placeId: string
): Promise<{ location?: { latitude: number; longitude: number } }> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_KEY is not set");
  }

  // IDs Only - request only id and location fields for FREE tier
  // Field mask format: no spaces, comma-separated
  const fieldMask = "id,location";

  const response = await fetch(`${PLACES_API_BASE}/places/${placeId}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Places API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

