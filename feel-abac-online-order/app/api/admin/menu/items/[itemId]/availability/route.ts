import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import {
  requireAdminWithPermission,
  PERMISSIONS,
} from "@/lib/api/admin-guard";
import { db } from "@/src/db/client";
import { menuItems } from "@/src/db/schema";

type RouteContext = {
  params: Promise<{
    itemId: string;
  }>;
};

/**
 * Toggle item availability (in stock / out of stock).
 * Accessible by moderators and above.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const result = await requireAdminWithPermission(PERMISSIONS.ITEM_TOGGLE_STOCK);
  if (!result) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { itemId: rawItemId } = await context.params;
  const itemId = rawItemId?.trim();

  if (!itemId) {
    return NextResponse.json(
      { error: "Menu item ID is required" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body.isAvailable !== "boolean") {
    return NextResponse.json(
      { error: "isAvailable (boolean) is required" },
      { status: 400 }
    );
  }

  const [item] = await db
    .update(menuItems)
    .set({
      isAvailable: body.isAvailable,
      updatedAt: new Date(),
    })
    .where(eq(menuItems.id, itemId))
    .returning();

  if (!item) {
    return NextResponse.json(
      { error: "Menu item not found" },
      { status: 404 }
    );
  }

  revalidateTag("public-menu", { expire: 0 });

  return NextResponse.json({
    item: {
      id: item.id,
      nameEn: item.nameEn,
      nameMm: item.nameMm,
      isAvailable: item.isAvailable,
    },
  });
}
