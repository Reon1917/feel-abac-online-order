import "server-only";

import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/src/db/client";
import { deliveryLocations, deliveryBuildings } from "@/src/db/schema";
import type { DeliveryLocationOption, DeliveryLocationRecord } from "@/lib/delivery/types";

async function loadLocations(includeInactive: boolean): Promise<DeliveryLocationRecord[]> {
  const baseQuery = db.select().from(deliveryLocations).orderBy(asc(deliveryLocations.condoName));

  const locations = includeInactive
    ? await baseQuery
    : await db
        .select()
        .from(deliveryLocations)
        .where(eq(deliveryLocations.isActive, true))
        .orderBy(asc(deliveryLocations.condoName));

  if (locations.length === 0) {
    return [];
  }

  const locationIds = locations.map((location) => location.id);

  const buildings = await db
    .select()
    .from(deliveryBuildings)
    .where(inArray(deliveryBuildings.locationId, locationIds))
    .orderBy(asc(deliveryBuildings.label));

  const buildingsByLocation = new Map<string, typeof buildings>();
  for (const building of buildings) {
    const current = buildingsByLocation.get(building.locationId) ?? [];
    current.push(building);
    buildingsByLocation.set(building.locationId, current);
  }

  return locations.map((location) => ({
    ...location,
    buildings: buildingsByLocation.get(location.id) ?? [],
  }));
}

export async function getDeliveryLocationsForAdmin(): Promise<DeliveryLocationRecord[]> {
  return loadLocations(true);
}

export async function getActiveDeliveryLocations(): Promise<DeliveryLocationOption[]> {
  const records = await loadLocations(false);

  return records.map((record) => ({
    id: record.id,
    slug: record.slug,
    condoName: record.condoName,
    area: record.area,
    minFee: record.minFee,
    maxFee: record.maxFee,
    notes: record.notes,
    buildings: record.buildings.map((building) => ({
      id: building.id,
      locationId: building.locationId,
      label: building.label,
    })),
  }));
}
