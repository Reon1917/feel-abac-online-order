import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { requireActiveAdmin } from "@/lib/api/admin-guard";
import { db } from "@/src/db/client";
import { deliveryLocations, deliveryBuildings } from "@/src/db/schema";
import { createDeliveryLocationSchema } from "@/lib/delivery/validation";
import { generateUniqueDeliverySlug } from "@/lib/delivery/slugs";

type RouteParams = {
  params: Promise<{
    locationId: string;
  }>;
};

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { locationId } = await params;
  const payload = await request.json();

  const parsed = createDeliveryLocationSchema.safeParse({
    condoName: payload.condoName,
    minFee: Number(payload.minFee),
    maxFee: Number(payload.maxFee),
    notes: payload.notes,
    buildings: Array.isArray(payload.buildings)
      ? payload.buildings
          .map((label: unknown) => (typeof label === "string" ? label.trim() : ""))
          .filter((label: string) => label.length > 0)
      : [],
  });

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 }
    );
  }

  const [existing] = await db
    .select()
    .from(deliveryLocations)
    .where(eq(deliveryLocations.id, locationId))
    .limit(1);

  if (!existing) {
    return Response.json({ error: "Delivery location not found" }, { status: 404 });
  }

  const trimmedName = parsed.data.condoName.trim();
  const shouldRegenerateSlug =
    trimmedName.toLowerCase() !== existing.condoName.toLowerCase();
  const slug = shouldRegenerateSlug
    ? await generateUniqueDeliverySlug(trimmedName)
    : existing.slug;

  // Store original state for rollback
  const originalLocation = { ...existing };
  const originalBuildings = await db
    .select()
    .from(deliveryBuildings)
    .where(eq(deliveryBuildings.locationId, locationId));

  try {
    // Update location
    await db
      .update(deliveryLocations)
      .set({
        slug,
        condoName: trimmedName,
        minFee: parsed.data.minFee,
        maxFee: parsed.data.maxFee,
        notes: parsed.data.notes?.trim() ?? null,
        updatedAt: new Date(),
      })
      .where(eq(deliveryLocations.id, locationId));

    // Delete existing buildings
    await db.delete(deliveryBuildings).where(eq(deliveryBuildings.locationId, locationId));

    // Insert new buildings
    if (parsed.data.buildings && parsed.data.buildings.length > 0) {
      await db.insert(deliveryBuildings).values(
        parsed.data.buildings.map((label) => ({
          locationId,
          label,
        }))
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    // Rollback: restore original location data
    try {
      await db
        .update(deliveryLocations)
        .set({
          slug: originalLocation.slug,
          condoName: originalLocation.condoName,
          minFee: originalLocation.minFee,
          maxFee: originalLocation.maxFee,
          notes: originalLocation.notes,
          updatedAt: originalLocation.updatedAt,
        })
        .where(eq(deliveryLocations.id, locationId));

      // Rollback: restore original buildings
      if (originalBuildings.length > 0) {
        await db.insert(deliveryBuildings).values(
          originalBuildings.map((building) => ({
            locationId: building.locationId,
            label: building.label,
          }))
        );
      }
    } catch (rollbackError) {
      // Log rollback failure but still return original error
      if (process.env.NODE_ENV !== "production") {
        console.error("Failed to rollback delivery location changes:", rollbackError);
      }
    }

    // Return error response
    const errorMessage =
      error instanceof Error ? error.message : "Failed to update delivery location";
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { locationId } = await params;

  const [existing] = await db
    .select({ id: deliveryLocations.id })
    .from(deliveryLocations)
    .where(eq(deliveryLocations.id, locationId))
    .limit(1);

  if (!existing) {
    return Response.json({ error: "Delivery location not found" }, { status: 404 });
  }

  try {
    await db.delete(deliveryLocations).where(eq(deliveryLocations.id, locationId));
    return Response.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete delivery location";
    return Response.json({ error: message }, { status: 500 });
  }
}
