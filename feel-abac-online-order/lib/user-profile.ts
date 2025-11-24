import "server-only";

import { db } from "@/src/db/client";
import { userProfiles } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { decryptPhone, encryptPhone } from "@/lib/crypto";
import type { DeliverySelection } from "@/lib/delivery/types";

export async function getUserProfile(userId: string) {
  if (!userId) return null;
  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1);

  if (!profile) return null;

  // Handle decryption - if it fails, assume it's plaintext (migration scenario)
  try {
    const decrypted = decryptPhone(profile.phoneNumber);
    return {
      ...profile,
      phoneNumber: decrypted,
    };
  } catch {
    // Phone number is likely not encrypted yet (plaintext from before encryption was added)
    return profile;
  }
}

export async function updateUserPhone(userId: string, phoneNumber: string) {
  const encryptedPhone = encryptPhone(phoneNumber);

  await db
    .update(userProfiles)
    .set({ phoneNumber: encryptedPhone })
    .where(eq(userProfiles.id, userId));
}

export async function updateUserDeliverySelection(
  userId: string,
  selection: DeliverySelection,
  options?: { coordinates?: { lat: number; lng: number } | null }
) {
  if (!userId) {
    throw new Error("Missing userId for delivery selection update");
  }

  const updatePayload: Record<string, unknown> = {
    deliverySelectionMode: selection.mode,
  };

  if (selection.mode === "preset") {
    updatePayload.defaultDeliveryLocationId = selection.locationId;
    updatePayload.defaultDeliveryBuildingId = selection.buildingId;
  } else {
    updatePayload.customCondoName = selection.customCondoName;
    updatePayload.customBuildingName = selection.customBuildingName;
    updatePayload.customPlaceId = selection.placeId ?? null;
    updatePayload.customUpdatedAt = new Date();
    const coords = options?.coordinates ?? null;
    updatePayload.customLat = coords ? coords.lat : null;
    updatePayload.customLng = coords ? coords.lng : null;
  }

  await db
    .update(userProfiles)
    .set(updatePayload)
    .where(eq(userProfiles.id, userId));
}

export function buildDeliverySelectionFromProfile(
  profile: Awaited<ReturnType<typeof getUserProfile>>
): DeliverySelection | null {
  if (!profile?.deliverySelectionMode) {
    return null;
  }

  if (
    profile.deliverySelectionMode === "preset" &&
    profile.defaultDeliveryLocationId
  ) {
    return {
      mode: "preset",
      locationId: profile.defaultDeliveryLocationId,
      buildingId: profile.defaultDeliveryBuildingId ?? null,
    };
  }

  if (
    profile.deliverySelectionMode === "custom" &&
    profile.customCondoName
  ) {
    return {
      mode: "custom",
      customCondoName: profile.customCondoName,
      customBuildingName: profile.customBuildingName ?? "",
      placeId: profile.customPlaceId ?? undefined,
      coordinates:
        profile.customLat != null && profile.customLng != null
          ? { lat: Number(profile.customLat), lng: Number(profile.customLng) }
          : null,
    };
  }

  return null;
}

export function buildCustomSelectionFromProfile(
  profile: Awaited<ReturnType<typeof getUserProfile>>
): DeliverySelection | null {
  if (!profile?.customCondoName) {
    return null;
  }

  return {
    mode: "custom",
    customCondoName: profile.customCondoName,
    customBuildingName: profile.customBuildingName ?? "",
    placeId: profile.customPlaceId ?? undefined,
    coordinates:
      profile.customLat != null && profile.customLng != null
        ? { lat: Number(profile.customLat), lng: Number(profile.customLng) }
        : null,
  };
}
