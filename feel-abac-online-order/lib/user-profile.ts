import "server-only";

import { db } from "@/src/db/client";
import { userProfiles } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { decryptPhone, encryptPhone } from "@/lib/crypto";

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
  } catch (error) {
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
