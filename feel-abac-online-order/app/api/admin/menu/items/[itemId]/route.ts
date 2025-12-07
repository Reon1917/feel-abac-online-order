import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import {
  deleteMenuImageByKey,
  parseMenuImageKey,
} from "@/lib/menu/image-storage";
import { db } from "@/src/db/client";
import { menuItems } from "@/src/db/schema";
import {
  menuItemUpdateSchema,
  toDecimalString,
} from "@/lib/menu/validators";
import {
  syncPoolLinksForMenuItem,
  getPoolLinksForMenuItem,
} from "@/lib/menu/pool-queries";

export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    itemId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { itemId: rawItemId } = await context.params;
  const itemId = rawItemId?.trim();
  if (!itemId) {
    return Response.json({ error: "Menu item ID is required" }, { status: 400 });
  }

  const [item] = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.id, itemId))
    .limit(1);

  if (!item) {
    return Response.json({ error: "Menu item not found" }, { status: 404 });
  }

  // If it's a set menu, include pool links
  if (item.isSetMenu) {
    const poolLinks = await getPoolLinksForMenuItem(itemId);
    return Response.json({ item: { ...item, poolLinks } });
  }

  return Response.json({ item });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { itemId: rawItemId } = await context.params;
  const itemId = rawItemId?.trim();
  if (!itemId) {
    return Response.json({ error: "Menu item ID is required" }, { status: 400 });
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
  const { poolLinks, ...itemUpdates } = updates;

  if (Object.keys(itemUpdates).length === 0 && !poolLinks) {
    return Response.json(
      { error: "No changes provided" },
      { status: 400 }
    );
  }

  const updateData: Partial<typeof menuItems.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (itemUpdates.categoryId !== undefined) {
    updateData.categoryId = itemUpdates.categoryId;
  }
  if (itemUpdates.nameEn !== undefined) {
    updateData.nameEn = itemUpdates.nameEn;
  }
  if (itemUpdates.nameMm !== undefined) {
    updateData.nameMm = itemUpdates.nameMm ?? null;
  }
  if (itemUpdates.descriptionEn !== undefined) {
    updateData.descriptionEn = itemUpdates.descriptionEn ?? null;
  }
  if (itemUpdates.descriptionMm !== undefined) {
    updateData.descriptionMm = itemUpdates.descriptionMm ?? null;
  }
  if (itemUpdates.placeholderIcon !== undefined) {
    updateData.placeholderIcon = itemUpdates.placeholderIcon ?? null;
  }
  if (itemUpdates.menuCode !== undefined) {
    updateData.menuCode = itemUpdates.menuCode ?? null;
  }
  if (itemUpdates.imageUrl !== undefined) {
    updateData.imageUrl = itemUpdates.imageUrl ?? null;
    updateData.hasImage = Boolean(itemUpdates.imageUrl);
  }
  if (itemUpdates.price !== undefined) {
    updateData.price = toDecimalString(itemUpdates.price);
  }
  if (itemUpdates.isAvailable !== undefined) {
    updateData.isAvailable = itemUpdates.isAvailable;
  }
  if (itemUpdates.isSetMenu !== undefined) {
    updateData.isSetMenu = itemUpdates.isSetMenu;
  }
  if (itemUpdates.allowUserNotes !== undefined) {
    updateData.allowUserNotes = itemUpdates.allowUserNotes;
  }
  if (itemUpdates.displayOrder !== undefined) {
    updateData.displayOrder = itemUpdates.displayOrder;
  }
  if (itemUpdates.status !== undefined) {
    updateData.status = itemUpdates.status;
  }
  if (itemUpdates.hasImage !== undefined && itemUpdates.imageUrl === undefined) {
    updateData.hasImage = itemUpdates.hasImage;
  }

  // Update item if there are changes
  let item;
  if (Object.keys(updateData).length > 1) { // More than just updatedAt
    [item] = await db
      .update(menuItems)
      .set(updateData)
      .where(eq(menuItems.id, itemId))
      .returning();
  } else {
    [item] = await db
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, itemId))
      .limit(1);
  }

  if (!item) {
    return Response.json({ error: "Menu item not found" }, { status: 404 });
  }

  // Sync pool links if provided and item is a set menu
  if (poolLinks !== undefined && (item.isSetMenu || itemUpdates.isSetMenu)) {
    await syncPoolLinksForMenuItem(
      itemId,
      poolLinks.map((link) => ({
        menuItemId: itemId,
        poolId: link.poolId,
        role: link.role,
        isPriceDetermining: link.isPriceDetermining,
        usesOptionPrice: link.usesOptionPrice,
        flatPrice: link.flatPrice,
        isRequired: link.isRequired,
        minSelect: link.minSelect,
        maxSelect: link.maxSelect,
        labelEn: link.labelEn,
        labelMm: link.labelMm,
        displayOrder: link.displayOrder,
      }))
    );
  }

  // If not a set menu anymore, clear pool links
  if (itemUpdates.isSetMenu === false) {
    await syncPoolLinksForMenuItem(itemId, []);
  }

  revalidateTag("public-menu", "default");

  // Return item with pool links if it's a set menu
  if (item.isSetMenu || itemUpdates.isSetMenu) {
    const updatedPoolLinks = await getPoolLinksForMenuItem(itemId);
    return Response.json({ item: { ...item, poolLinks: updatedPoolLinks } });
  }

  return Response.json({ item });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { itemId: rawItemId } = await context.params;
  const itemId = rawItemId?.trim();
  if (!itemId) {
    return Response.json({ error: "Menu item ID is required" }, { status: 400 });
  }

  const [item] = await db
    .delete(menuItems)
    .where(eq(menuItems.id, itemId))
    .returning();

  if (!item) {
    return Response.json({ error: "Menu item not found" }, { status: 404 });
  }

  const imageKey = parseMenuImageKey(item.imageUrl);
  if (imageKey) {
    await deleteMenuImageByKey(imageKey).catch(() => undefined);
  }

  revalidateTag("public-menu", "default");

  return Response.json({ success: true });
}
