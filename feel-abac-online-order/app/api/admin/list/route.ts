import { NextRequest } from "next/server";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import { db } from "@/src/db/client";
import { admins } from "@/src/db/schema";

export async function GET(request: NextRequest) {
  const sessionData = await requireActiveAdmin();

  if (!sessionData?.session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const adminList = await db
    .select({
      id: admins.id,
      userId: admins.userId,
      email: admins.email,
      name: admins.name,
      role: admins.role,
      isActive: admins.isActive,
      createdAt: admins.createdAt,
    })
    .from(admins)
    .orderBy(admins.createdAt);

  return Response.json(adminList);
}

