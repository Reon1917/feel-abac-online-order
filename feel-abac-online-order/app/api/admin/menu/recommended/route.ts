import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { requireActiveAdmin, requireMenuAccess } from "@/lib/api/admin-guard";
import { db } from "@/src/db/client";
import { menuItems, recommendedMenuItems } from "@/src/db/schema";
import {
  recommendedMenuItemSchema,
} from "@/lib/menu/validators";
import { getAdminRecommendedMenuItems } from "@/lib/menu/recommendations";

export const revalidate = 0;

export async function GET() {
  const result = await requireActiveAdmin();
  if (!result) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const recommendations = await getAdminRecommendedMenuItems();
  return Response.json({ recommendations });
}

export async function POST(request: NextRequest) {
  const result = await requireMenuAccess();
  if (!result) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json();
  const parsed = recommendedMenuItemSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 }
    );
  }

  const values = parsed.data;

  const itemRecord = await db
    .select({
      id: menuItems.id,
      categoryId: menuItems.categoryId,
    })
    .from(menuItems)
    .where(eq(menuItems.id, values.menuItemId))
    .limit(1);

  const item = itemRecord[0];
  if (!item) {
    return Response.json({ error: "Menu item not found" }, { status: 404 });
  }

  const existingRecommendation = await db
    .select({ id: recommendedMenuItems.id })
    .from(recommendedMenuItems)
    .where(eq(recommendedMenuItems.menuItemId, item.id))
    .limit(1);

  if (existingRecommendation.length > 0) {
    return Response.json(
      { error: "This menu item is already featured" },
      { status: 409 }
    );
  }

  const [lastOrder] = await db
    .select({ displayOrder: recommendedMenuItems.displayOrder })
    .from(recommendedMenuItems)
    .orderBy(desc(recommendedMenuItems.displayOrder))
    .limit(1);

  const [recommendation] = await db
    .insert(recommendedMenuItems)
    .values({
      menuCategoryId: item.categoryId,
      menuItemId: item.id,
      badgeLabel: values.badgeLabel ?? null,
      displayOrder:
        lastOrder?.displayOrder !== undefined
          ? lastOrder.displayOrder + 1
          : 0,
    })
    .returning();

  revalidateTag("public-menu", "default");

  return Response.json(
    { recommendation },
    { status: 201 }
  );
}
