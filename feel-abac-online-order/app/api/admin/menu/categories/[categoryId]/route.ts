import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import {
  deleteMenuImageByKey,
  parseMenuImageKey,
} from "@/lib/menu/image-storage";
import { db } from "@/src/db/client";
import { menuCategories, menuItems } from "@/src/db/schema";
import { menuCategoryUpdateSchema } from "@/lib/menu/validators";

type RouteParams = {
  params: Promise<{
    categoryId: string;
  }>;
};

export const revalidate = 0;

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { categoryId } = await params;

  const payload = await request.json();
  const parsed = menuCategoryUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 }
    );
  }

  const updates = parsed.data;
  if (Object.keys(updates).length === 0) {
    return Response.json(
      { error: "No changes provided" },
      { status: 400 }
    );
  }

  const updateData: Partial<typeof menuCategories.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (updates.nameEn !== undefined) {
    updateData.nameEn = updates.nameEn;
  }
  if (updates.nameMm !== undefined) {
    updateData.nameMm = updates.nameMm ?? null;
  }
  if (updates.displayOrder !== undefined) {
    updateData.displayOrder = updates.displayOrder;
  }
  if (updates.isActive !== undefined) {
    updateData.isActive = updates.isActive;
  }

  const [category] = await db
    .update(menuCategories)
    .set(updateData)
    .where(eq(menuCategories.id, categoryId))
    .returning();

  if (!category) {
    return Response.json({ error: "Category not found" }, { status: 404 });
  }

  return Response.json({ category });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { categoryId } = await params;

  const items = await db
    .select({
      id: menuItems.id,
      imageUrl: menuItems.imageUrl,
    })
    .from(menuItems)
    .where(eq(menuItems.categoryId, categoryId));

  const [category] = await db
    .delete(menuCategories)
    .where(eq(menuCategories.id, categoryId))
    .returning();

  if (!category) {
    return Response.json({ error: "Category not found" }, { status: 404 });
  }

  for (const item of items) {
    const imageKey = parseMenuImageKey(item.imageUrl);
    if (!imageKey) continue;
    await deleteMenuImageByKey(imageKey).catch(() => undefined);
  }

  return Response.json({ success: true });
}
