import "server-only";

import { db } from "@/src/db/client";
import { deliveryLocations, deliveryBuildings } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import type { CreateDeliveryLocationInput } from "@/lib/delivery/validation";
import type { DeliveryLocationRecord } from "@/lib/delivery/types";
import { generateUniqueDeliverySlug } from "@/lib/delivery/slugs";

const MAX_RETRY_ATTEMPTS = 5;

function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message ?? "";
  const code = (error as { code?: string }).code;
  return (
    /unique|duplicate/i.test(message) ||
    code === "23505" ||
    code === "P2002"
  );
}

export async function createDeliveryLocation(
  input: CreateDeliveryLocationInput
): Promise<DeliveryLocationRecord> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      const slug = await generateUniqueDeliverySlug(input.condoName);

      const [location] = await db
        .insert(deliveryLocations)
        .values({
          slug,
          condoName: input.condoName.trim(),
          area: "AU",
          minFee: input.minFee,
          maxFee: input.maxFee,
          notes: input.notes?.trim() ?? null,
          isActive: true,
        })
        .returning();

      if (!location) {
        throw new Error("Failed to create delivery location");
      }

      const buildingsToInsert = input.buildings?.map((label) => ({
        locationId: location.id,
        label: label.trim(),
      }));

      let buildingRecords: Array<{
        id: string;
        locationId: string;
        label: string;
        createdAt: Date;
        updatedAt: Date;
      }> = [];
      try {
        buildingRecords =
          buildingsToInsert && buildingsToInsert.length > 0
            ? await db.insert(deliveryBuildings).values(buildingsToInsert).returning()
            : [];
      } catch (buildingsError) {
        // Rollback: delete location if buildings insert fails
        await db.delete(deliveryLocations).where(eq(deliveryLocations.id, location.id));
        throw buildingsError;
      }

      return {
        ...location,
        buildings: buildingRecords,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If it's a unique constraint error on slug, retry with new slug
      if (isUniqueConstraintError(error)) {
        // Check if error message mentions slug
        const errorMessage = lastError.message.toLowerCase();
        if (errorMessage.includes("slug") || errorMessage.includes("delivery_locations_slug_unique")) {
          // Continue to next retry attempt
          continue;
        }
      }

      // For non-slug unique constraint errors or other errors, rethrow immediately
      throw lastError;
    }
  }

  // Exhausted retries
  throw new Error(
    `Failed to create delivery location after ${MAX_RETRY_ATTEMPTS} attempts due to slug conflicts. ${lastError?.message ?? ""}`
  );
}
