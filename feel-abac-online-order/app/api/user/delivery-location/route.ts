import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/src/db/client";
import { deliveryLocations, deliveryBuildings } from "@/src/db/schema";
import { updateUserDefaultDeliverySelection } from "@/lib/user-profile";

const userDeliveryPreferenceSchema = z.object({
  locationId: z
    .string()
    .uuid("Invalid location")
    .optional()
    .nullable(),
  buildingId: z
    .string()
    .uuid("Invalid building")
    .optional()
    .nullable(),
});

export async function PUT(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = userDeliveryPreferenceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
        { status: 400 }
      );
    }

    let locationId = parsed.data.locationId ?? null;
    const requestedBuildingId = parsed.data.buildingId ?? null;

    if (locationId) {
      const [location] = await db
        .select({ id: deliveryLocations.id })
        .from(deliveryLocations)
        .where(eq(deliveryLocations.id, locationId))
        .limit(1);

      if (!location) {
        return NextResponse.json({ error: "Location not found" }, { status: 404 });
      }
    }

    let buildingIdToPersist = requestedBuildingId;

    if (buildingIdToPersist) {
      const [building] = await db
        .select({
          id: deliveryBuildings.id,
          locationId: deliveryBuildings.locationId,
        })
        .from(deliveryBuildings)
        .where(eq(deliveryBuildings.id, buildingIdToPersist))
        .limit(1);

      if (!building) {
        return NextResponse.json({ error: "Building not found" }, { status: 404 });
      }

      if (locationId && building.locationId !== locationId) {
        return NextResponse.json(
          { error: "Building does not belong to the selected condo" },
          { status: 400 }
        );
      }

      if (!locationId) {
        locationId = building.locationId;
      }

      buildingIdToPersist = building.id;
    }

    await updateUserDefaultDeliverySelection(
      session.user.id,
      locationId,
      buildingIdToPersist
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update delivery preference", error);
    return NextResponse.json(
      { error: "Failed to update delivery preference" },
      { status: 500 }
    );
  }
}
