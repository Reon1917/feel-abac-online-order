"use server";

import { Buffer } from "node:buffer";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/src/db/client";
import { userProfiles } from "@/src/db/schema";
import { onboardingSchema } from "@/lib/validations";
import { encryptPhone } from "@/lib/crypto";
import { withLocalePath } from "@/lib/i18n/path";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { mapToSupportedLocale } from "@/lib/i18n/utils";

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

  const localeHeader = headerList.get("x-feel-locale");
  const locale = mapToSupportedLocale(localeHeader) ?? DEFAULT_LOCALE;
  redirect(withLocalePath(locale as Locale, "/menu"));
}
