import "server-only";

import { db } from "@/src/db/client";
import { userProfiles } from "@/src/db/schema";
import { eq } from "drizzle-orm";

export async function getUserProfile(userId: string) {
  if (!userId) return null;
  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1);
  return profile ?? null;
}
