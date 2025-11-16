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

  await db.delete(deliveryBuildings).where(eq(deliveryBuildings.locationId, locationId));

  if (parsed.data.buildings && parsed.data.buildings.length > 0) {
    await db.insert(deliveryBuildings).values(
      parsed.data.buildings.map((label) => ({
        locationId,
        label,
      }))
    );
  }

  return Response.json({ success: true });
}
