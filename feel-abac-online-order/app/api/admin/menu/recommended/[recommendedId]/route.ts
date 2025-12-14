import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { requireMenuAccess } from "@/lib/api/admin-guard";
import { db } from "@/src/db/client";
import { recommendedMenuItems } from "@/src/db/schema";
import { recommendedMenuItemUpdateSchema } from "@/lib/menu/validators";

type RouteParams = {
  params: Promise<{
    recommendedId: string;
  }>;
};

export const revalidate = 0;

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const result = await requireMenuAccess();
  if (!result) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { recommendedId } = await params;
  const payload = await request.json();
  const parsed = recommendedMenuItemUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 }
    );
  }

  const updates = parsed.data;
  if (!Object.prototype.hasOwnProperty.call(updates, "badgeLabel")) {
    return Response.json(
      { error: "No changes provided" },
      { status: 400 }
    );
  }

  const [recommendation] = await db
    .update(recommendedMenuItems)
    .set({
      badgeLabel:
        updates.badgeLabel === undefined ? null : updates.badgeLabel,
      updatedAt: new Date(),
    })
    .where(eq(recommendedMenuItems.id, recommendedId))
    .returning();

  if (!recommendation) {
    return Response.json(
      { error: "Recommendation not found" },
      { status: 404 }
    );
  }

  revalidateTag("public-menu", "default");

  return Response.json({ recommendation });
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  const result = await requireMenuAccess();
  if (!result) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { recommendedId } = await params;

  const [recommendation] = await db
    .delete(recommendedMenuItems)
    .where(eq(recommendedMenuItems.id, recommendedId))
    .returning();

  if (!recommendation) {
    return Response.json(
      { error: "Recommendation not found" },
      { status: 404 }
    );
  }

  revalidateTag("public-menu", "default");

  return Response.json({ success: true });
}
