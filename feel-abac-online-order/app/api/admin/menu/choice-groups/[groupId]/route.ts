import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import { db } from "@/src/db/client";
import { menuChoiceGroups } from "@/src/db/schema";
import { menuChoiceGroupUpdateSchema } from "@/lib/menu/validators";

type RouteParams = {
  params: {
    groupId: string;
  };
};

export const revalidate = 0;

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const payload = await request.json();
  const parsed = menuChoiceGroupUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 }
    );
  }

  const updates = parsed.data;

  const [existing] = await db
    .select()
    .from(menuChoiceGroups)
    .where(eq(menuChoiceGroups.id, params.groupId))
    .limit(1);

  if (!existing) {
    return Response.json({ error: "Choice group not found" }, { status: 404 });
  }

  const nextMin = updates.minSelect ?? existing.minSelect;
  const nextMax = updates.maxSelect ?? existing.maxSelect;

  if (nextMax < nextMin) {
    return Response.json(
      { error: "Max select must be greater than or equal to min select" },
      { status: 400 }
    );
  }

  const updateData: Partial<typeof menuChoiceGroups.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (updates.menuItemId !== undefined) {
    updateData.menuItemId = updates.menuItemId;
  }
  if (updates.titleEn !== undefined) {
    updateData.titleEn = updates.titleEn;
  }
  if (updates.titleMm !== undefined) {
    updateData.titleMm = updates.titleMm ?? null;
  }
  if (updates.minSelect !== undefined) {
    updateData.minSelect = updates.minSelect;
  }
  if (updates.maxSelect !== undefined) {
    updateData.maxSelect = updates.maxSelect;
  }
  if (updates.isRequired !== undefined) {
    updateData.isRequired = updates.isRequired;
  }
  if (updates.displayOrder !== undefined) {
    updateData.displayOrder = updates.displayOrder;
  }
  if (updates.type !== undefined) {
    updateData.type = updates.type;
  }

  const [group] = await db
    .update(menuChoiceGroups)
    .set(updateData)
    .where(eq(menuChoiceGroups.id, params.groupId))
    .returning();

  return Response.json({ group });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const [group] = await db
    .delete(menuChoiceGroups)
    .where(eq(menuChoiceGroups.id, params.groupId))
    .returning();

  if (!group) {
    return Response.json({ error: "Choice group not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
