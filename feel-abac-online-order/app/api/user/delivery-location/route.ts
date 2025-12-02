import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/src/db/client";
import { deliveryLocations, deliveryBuildings } from "@/src/db/schema";
import { updateUserDeliverySelection } from "@/lib/user-profile";
import type { DeliverySelection } from "@/lib/delivery/types";

const userDeliveryPreferenceSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("preset"),
    locationId: z.string().uuid("Invalid location"),
    buildingId: z
      .string()
      .uuid("Invalid building")
      .optional()
      .nullable(),
  }),
  z.object({
    mode: z.literal("custom"),
    customCondoName: z.string().min(1, "Condo name is required").max(255),
    customBuildingName: z.string().max(255).optional().nullable(),
    placeId: z.string().min(1).max(255).optional().nullable(),
    coordinates: z
      .object({
        lat: z.number(),
        lng: z.number(),
      })
      .optional()
      .nullable(),
  }),
]);

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

    let selectionToPersist: DeliverySelection | null = null;
    let coordinates: { lat: number; lng: number } | null = null;

    if (parsed.data.mode === "preset") {
      let locationId = parsed.data.locationId;
      const requestedBuildingId = parsed.data.buildingId ?? null;

      const [location] = await db
        .select({ id: deliveryLocations.id })
        .from(deliveryLocations)
        .where(eq(deliveryLocations.id, locationId))
        .limit(1);

      if (!location) {
        return NextResponse.json({ error: "Location not found" }, { status: 404 });
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

      selectionToPersist = {
        mode: "preset",
        locationId,
        buildingId: buildingIdToPersist ?? null,
      };
    } else {
      selectionToPersist = {
        mode: "custom",
        customCondoName: parsed.data.customCondoName,
        customBuildingName: parsed.data.customBuildingName ?? "",
        placeId: parsed.data.placeId ?? undefined,
        coordinates: parsed.data.coordinates ?? null,
      };
      coordinates = parsed.data.coordinates ?? null;
    }

    await updateUserDeliverySelection(session.user.id, selectionToPersist, {
      coordinates,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Failed to update delivery preference", error);
    }
    return NextResponse.json(
      { error: "Failed to update delivery preference" },
      { status: 500 }
    );
  }
}
