import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import { db } from "@/src/db/client";
import { admins } from "@/src/db/schema";

export async function DELETE(request: NextRequest) {
  const sessionData = await requireActiveAdmin();

  if (!sessionData?.session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const [currentAdmin] = await db
    .select()
    .from(admins)
    .where(eq(admins.userId, sessionData.session.user.id))
    .limit(1);

  if (!currentAdmin || currentAdmin.role !== "super_admin") {
    return Response.json(
      { error: "Only super admins can remove admins" },
      { status: 403 }
    );
  }

  const { userId } = await request.json();

  // Prevent self-removal
  if (userId === sessionData.session.user.id) {
    return Response.json(
      { error: "You can't remove yourself! Ask another super admin to do it." },
      { status: 400 }
    );
  }

  await db.delete(admins).where(eq(admins.userId, userId));

  return Response.json({ success: true });
}

