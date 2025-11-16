import "server-only";

import { db } from "@/src/db/client";
import { deliveryLocations, deliveryBuildings } from "@/src/db/schema";
import type { CreateDeliveryLocationInput } from "@/lib/delivery/validation";
import type { DeliveryLocationRecord } from "@/lib/delivery/types";
import { generateUniqueDeliverySlug } from "@/lib/delivery/slugs";

export async function createDeliveryLocation(
  input: CreateDeliveryLocationInput
): Promise<DeliveryLocationRecord> {
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

  const buildingsToInsert = input.buildings?.map((label) => ({
    locationId: location.id,
    label: label.trim(),
  }));

  const buildingRecords =
    buildingsToInsert && buildingsToInsert.length > 0
      ? await db.insert(deliveryBuildings).values(buildingsToInsert).returning()
      : [];

  return {
    ...location,
    buildings: buildingRecords,
  };
}
