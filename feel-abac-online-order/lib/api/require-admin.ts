import { db } from "@/src/db/client";
import { admins } from "@/src/db/schema";
import { eq } from "drizzle-orm";

export async function requireAdmin(userId: string | null | undefined) {
  if (!userId) return null;

  const adminRow =
    (await db
      .select({ id: admins.id })
      .from(admins)
      .where(eq(admins.userId, userId))
      .limit(1))[0] ?? null;

  return adminRow;
}
