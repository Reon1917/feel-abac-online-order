"use server";

import { Buffer } from "node:buffer";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/src/db/client";
import { userProfiles } from "@/src/db/schema";
import { onboardingSchema } from "@/lib/validations";
import { encryptPhone } from "@/lib/crypto";
import { withLocalePath } from "@/lib/i18n/path";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { mapToSupportedLocale } from "@/lib/i18n/utils";
import { getActiveDeliveryLocations } from "@/lib/delivery/queries";
import type { DeliverySelection } from "@/lib/delivery/types";
import { updateUserDeliverySelection } from "@/lib/user-profile";

type ActionState = { error?: string; ok?: boolean };

async function extractSessionUserId() {
  const headerList = await headers();
  const encoded = headerList.get("x-feel-session");
  if (!encoded) return null;
  try {
    const decoded = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as { session?: { user?: { id?: string } } };
    return decoded.session?.user?.id ?? null;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Failed to parse session header", error);
    }
    return null;
  }
}

async function extractLocale(): Promise<Locale> {
  const headerList = await headers();
  const localeHeader = headerList.get("x-feel-locale");
  return (mapToSupportedLocale(localeHeader) ?? DEFAULT_LOCALE) as Locale;
}

export async function saveOnboardingPhone(
  _prev: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const parsed = onboardingSchema.safeParse({
    phoneNumber: formData.get("phoneNumber"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid phone number",
    };
  }

  const userId = await extractSessionUserId();
  if (!userId) {
    return { error: "You need to be signed in to continue." };
  }

  const encryptedPhone = encryptPhone(parsed.data.phoneNumber);

  await db
    .insert(userProfiles)
    .values({
      id: userId,
      phoneNumber: encryptedPhone,
    })
    .onConflictDoUpdate({
      target: userProfiles.id,
      set: {
        phoneNumber: encryptedPhone,
      },
    });

  return { ok: true };
}

const coordinatesSchema = z
  .object({
    lat: z.number(),
    lng: z.number(),
  })
  .nullable()
  .optional();

const presetSchema = z.object({
  mode: z.literal("preset"),
  locationId: z.string().min(1),
  buildingId: z.string().nullable().optional(),
});

const customSchema = z.object({
  mode: z.literal("custom"),
  customCondoName: z.string().min(1),
  customBuildingName: z.string().optional().default(""),
  placeId: z.string().nullable().optional(),
  coordinates: coordinatesSchema,
});

const selectionSchema = z.discriminatedUnion("mode", [presetSchema, customSchema]);

export async function completeOnboardingWithLocation(
  _prev: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const userId = await extractSessionUserId();
  if (!userId) {
    return { error: "You need to be signed in to continue." };
  }

  const rawSelection = formData.get("selection");
  if (!rawSelection || typeof rawSelection !== "string") {
    return { error: "Please choose a delivery location." };
  }

  let parsedSelection: DeliverySelection;
  try {
    parsedSelection = selectionSchema.parse(JSON.parse(rawSelection)) as DeliverySelection;
  } catch {
    return { error: "Invalid delivery selection." };
  }

  if (parsedSelection.mode === "preset") {
    const locations = await getActiveDeliveryLocations();
    const location = locations.find((loc) => loc.id === parsedSelection.locationId);
    if (!location) {
      return { error: "Selected location is no longer available." };
    }
    if (parsedSelection.buildingId) {
      const buildingExists = location.buildings.some(
        (building) => building.id === parsedSelection.buildingId
      );
      if (!buildingExists) {
        return { error: "Selected building is not available for this location." };
      }
    }
  }

  await updateUserDeliverySelection(userId, parsedSelection, {
    coordinates:
      parsedSelection.mode === "custom" ? parsedSelection.coordinates ?? null : undefined,
  });

  const locale = await extractLocale();
  redirect(withLocalePath(locale, "/menu"));
}
