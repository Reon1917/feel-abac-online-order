import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import { db } from "@/src/db/client";
import { menuItems } from "@/src/db/schema";
import {
  menuItemUpdateSchema,
  toDecimalString,
} from "@/lib/menu/validators";

type RouteParams = {
  params: {
    itemId: string;
  };
};

export const revalidate = 0;

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const payload = await request.json();
  const parsed = menuItemUpdateSchema.safeParse(payload);
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

  const updateData: Partial<typeof menuItems.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (updates.categoryId !== undefined) {
    updateData.categoryId = updates.categoryId;
  }
  if (updates.nameEn !== undefined) {
    updateData.nameEn = updates.nameEn;
  }
  if (updates.nameMm !== undefined) {
    updateData.nameMm = updates.nameMm ?? null;
  }
  if (updates.descriptionEn !== undefined) {
    updateData.descriptionEn = updates.descriptionEn ?? null;
  }
  if (updates.descriptionMm !== undefined) {
    updateData.descriptionMm = updates.descriptionMm ?? null;
  }
  if (updates.placeholderIcon !== undefined) {
    updateData.placeholderIcon = updates.placeholderIcon ?? null;
  }
  if (updates.imageUrl !== undefined) {
    updateData.imageUrl = updates.imageUrl ?? null;
    updateData.hasImage = Boolean(updates.imageUrl);
  }
  if (updates.price !== undefined) {
    updateData.price = toDecimalString(updates.price);
  }
  if (updates.isAvailable !== undefined) {
    updateData.isAvailable = updates.isAvailable;
  }
  if (updates.allowUserNotes !== undefined) {
    updateData.allowUserNotes = updates.allowUserNotes;
  }
  if (updates.displayOrder !== undefined) {
    updateData.displayOrder = updates.displayOrder;
  }
  if (updates.hasImage !== undefined && updates.imageUrl === undefined) {
    updateData.hasImage = updates.hasImage;
  }

  const [item] = await db
    .update(menuItems)
    .set(updateData)
    .where(eq(menuItems.id, params.itemId))
    .returning();

  if (!item) {
    return Response.json({ error: "Menu item not found" }, { status: 404 });
  }

  return Response.json({ item });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const [item] = await db
    .delete(menuItems)
    .where(eq(menuItems.id, params.itemId))
    .returning();

  if (!item) {
    return Response.json({ error: "Menu item not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
