"use server";

import { headers } from "next/headers";
import { Buffer } from "node:buffer";
import { z } from "zod";

import { updateUserName, updateUserPhone } from "@/lib/user-profile";
import { onboardingSchema } from "@/lib/validations";

type ProfileActionState = { success?: boolean; error?: string } | null;

const profileNameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name is too long");

async function extractSessionUserId() {
  const headerList = await headers();
  const encoded = headerList.get("x-feel-session");
  if (!encoded) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as {
      session?: {
        user?: { id?: string };
      };
    };
    return decoded.session?.user?.id?.trim() ?? null;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Failed to parse session header", error);
    }
    return null;
  }
}

export async function updateNameAction(
  _prevState: ProfileActionState,
  formData: FormData
) {
  const parsed = profileNameSchema.safeParse(formData.get("name"));

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid name",
    };
  }

  const userId = await extractSessionUserId();
  if (!userId) {
    return {
      success: false,
      error: "You need to be signed in to continue.",
    };
  }

  try {
    await updateUserName(userId, parsed.data);
    return { success: true };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Failed to update name", error);
    }
    return {
      success: false,
      error: "Failed to update name. Please try again.",
    };
  }
}

export async function updatePhoneAction(
  _prevState: ProfileActionState,
  formData: FormData
) {
  const parsed = onboardingSchema.safeParse({
    phoneNumber: formData.get("phoneNumber"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid phone number",
    };
  }

  const userId = await extractSessionUserId();

  if (!userId) {
    return {
      success: false,
      error: "You need to be signed in to continue.",
    };
  }

  try {
    await updateUserPhone(userId, parsed.data.phoneNumber);
    return { success: true };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Failed to update phone", error);
    }
    return {
      success: false,
      error: "Failed to update phone number. Please try again.",
    };
  }
}
