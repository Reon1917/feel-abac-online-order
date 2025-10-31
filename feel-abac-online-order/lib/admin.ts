import { eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { admins } from "@/src/db/schema";

export async function getAdminByUserId(userId: string) {
  const [admin] = await db
    .select()
    .from(admins)
    .where(eq(admins.userId, userId))
    .limit(1);
  
  return admin;
}

export async function isActiveAdmin(userId: string): Promise<boolean> {
  const admin = await getAdminByUserId(userId);
  return !!admin?.isActive;
}

