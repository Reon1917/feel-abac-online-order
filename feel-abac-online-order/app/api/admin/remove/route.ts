import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/api/admin-guard";
import { db } from "@/src/db/client";
import { admins } from "@/src/db/schema";

export async function DELETE(request: NextRequest) {
  const result = await requireSuperAdmin();
  if (!result) {
    return Response.json(
      { error: "Only super admins can remove admins" },
      { status: 403 }
    );
  }

  const { userId } = await request.json();

  // Prevent self-removal
  if (userId === result.session.session.user.id) {
    return Response.json(
      { error: "You can't remove yourself! Ask another super admin to do it." },
      { status: 400 }
    );
  }

  await db.delete(admins).where(eq(admins.userId, userId));

  return Response.json({ success: true });
}
