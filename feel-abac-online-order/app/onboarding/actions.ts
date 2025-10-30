"use server";

import { Buffer } from "node:buffer";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/src/db/client";
import { userProfiles } from "@/src/db/schema";
import { onboardingSchema } from "@/lib/validations";

export async function completeOnboarding(prevState: { error?: string } | null, formData: FormData) {
  const parsed = onboardingSchema.safeParse({
    phoneNumber: formData.get("phoneNumber"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid phone number",
    };
  }

  const headerList = await headers();
  const encoded = headerList.get("x-feel-session");
  if (!encoded) {
    return {
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
    console.error("Failed to parse session header", error);
    userId = null;
  }

  if (!userId) {
    return {
      error: "You need to be signed in to continue.",
    };
  }

  await db
    .insert(userProfiles)
    .values({
      id: userId,
      phoneNumber: parsed.data.phoneNumber,
    })
    .onConflictDoUpdate({
      target: userProfiles.id,
      set: {
        phoneNumber: parsed.data.phoneNumber,
      },
    });

  redirect("/menu");
}
