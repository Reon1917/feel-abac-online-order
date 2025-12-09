import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import crypto from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import { db } from "@/src/db/client";
import { menuItems } from "@/src/db/schema";
import { menuItemSchema, toDecimalString } from "@/lib/menu/validators";
import { getPoolLinksForMenuItem } from "@/lib/menu/pool-queries";

export const revalidate = 0;

export async function GET(request: NextRequest) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId");
  const includePoolLinks = searchParams.get("includePoolLinks") === "true";

  const baseQuery = db.select().from(menuItems);

  const filteredQuery = categoryId
    ? baseQuery.where(eq(menuItems.categoryId, categoryId))
    : baseQuery;

  const items = await filteredQuery.orderBy(
    asc(menuItems.displayOrder),
    asc(menuItems.createdAt)
  );

  // If includePoolLinks is requested, fetch pool links for set menu items
  if (includePoolLinks) {
    const itemsWithLinks = await Promise.all(
      items.map(async (item) => {
        if (!item.isSetMenu) {
          return { ...item, poolLinks: [] };
        }
        try {
          const poolLinks = await getPoolLinksForMenuItem(item.id);
          return { ...item, poolLinks };
        } catch (error) {
          if (process.env.NODE_ENV !== "production") {
            // Log and continue so one bad item doesn't break the whole response
            console.error(
              "[GET /api/admin/menu/items] Failed to load pool links for item",
              { itemId: item.id, error }
            );
          }
          return { ...item, poolLinks: [], poolLinksError: true as const };
        }
      })
    );
    return Response.json({ items: itemsWithLinks });
  }

  return Response.json({ items });
}

export async function POST(request: NextRequest) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const payload = await request.json();
  const parsed = menuItemSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 }
    );
  }

  const values = parsed.data;

  const [item] = await db
    .insert(menuItems)
    .values({
      id: crypto.randomUUID(),
      categoryId: values.categoryId,
      nameEn: values.nameEn,
      nameMm: values.nameMm ?? null,
      descriptionEn: values.descriptionEn ?? null,
      descriptionMm: values.descriptionMm ?? null,
      placeholderIcon: values.placeholderIcon ?? null,
      menuCode: values.menuCode ?? null,
      imageUrl: values.imageUrl ?? null,
      price: toDecimalString(values.price),
      isAvailable: values.isAvailable ?? true,
      isSetMenu: values.isSetMenu ?? false,
      allowUserNotes: values.allowUserNotes ?? false,
      displayOrder: values.displayOrder ?? 0,
      hasImage: values.hasImage ?? Boolean(values.imageUrl),
      status: values.status ?? "draft",
    })
    .returning();

  revalidateTag("public-menu", "default");

  return Response.json({ item }, { status: 201 });
}
