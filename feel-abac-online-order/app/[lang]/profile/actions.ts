"use server";

import { headers } from "next/headers";
import { Buffer } from "node:buffer";
import { updateUserPhone } from "@/lib/user-profile";
import { onboardingSchema } from "@/lib/validations";

export async function updatePhoneAction(
  _prevState: { success?: boolean; error?: string } | null,
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

  const headerList = await headers();
  const encoded = headerList.get("x-feel-session");
  if (!encoded) {
    return {
      success: false,
      error: "You need to be signed in to continue.",
    };
  }

  let userId: string | null = null;

  try {
    const decoded = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as {
      session?: {
        user?: { id?: string };
      };
    };
    userId = decoded.session?.user?.id ?? null;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Failed to parse session header", error);
    }
    userId = null;
  }

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
