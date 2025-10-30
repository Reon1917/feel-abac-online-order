"use server";

import { Buffer } from "node:buffer";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/src/db/client";
import { userProfiles } from "@/src/db/schema";

const phoneSchema = z.object({
  phoneNumber: z
    .string()
    .min(8, "Enter a valid phone number")
    .max(20, "Phone number is too long"),
});

export async function completeOnboarding(prevState: { error?: string } | null, formData: FormData) {
  const parsed = phoneSchema.safeParse({
    phoneNumber: formData.get("phoneNumber"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.errors[0]?.message ?? "Invalid phone number",
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
