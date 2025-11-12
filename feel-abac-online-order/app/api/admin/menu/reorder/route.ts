import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import { db } from "@/src/db/client";
import { menuCategories, menuItems } from "@/src/db/schema";
import { menuReorderSchema, type MenuReorderPayload } from "@/lib/menu/validators";

export const revalidate = 0;

type CategoryReorderPayload = Extract<MenuReorderPayload, { mode: "categories" }>;
type ItemReorderPayload = Extract<MenuReorderPayload, { mode: "items" }>;

export async function POST(request: NextRequest) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = menuReorderSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Response.json(
      { error: issue?.message ?? "Invalid payload" },
      { status: 400 }
    );
  }

  const payload = parsed.data;

  try {
    if (payload.mode === "categories") {
      const response = await applyCategoryReorder(payload);
      revalidateTag("public-menu", "default");
      return response;
    }

    const response = await applyItemReorder(payload);
    revalidateTag("public-menu", "default");
    return response;
  } catch (error) {
    console.error("[menu/reorder] failed to update display order", error);
    return Response.json(
      { error: "Failed to apply display order updates" },
      { status: 500 }
    );
  }
}

async function applyCategoryReorder(payload: CategoryReorderPayload) {
  const ids = payload.categories.map((entry) => entry.id);

  const rows =
    ids.length === 0
      ? []
      : await db
          .select({
            id: menuCategories.id,
            displayOrder: menuCategories.displayOrder,
          })
          .from(menuCategories)
          .where(inArray(menuCategories.id, ids));

  if (rows.length !== ids.length) {
    return Response.json(
      { error: "One or more categories could not be found" },
      { status: 400 }
    );
  }

  const displayOrderById = new Map(rows.map((row) => [row.id, row.displayOrder]));
  const changes = payload.categories.filter((entry) => {
    const current = displayOrderById.get(entry.id);
    return current === undefined ? false : current !== entry.displayOrder;
  });

  if (changes.length === 0) {
    return Response.json({ success: true, updated: 0 });
  }

  for (const entry of changes) {
    await db
      .update(menuCategories)
      .set({ displayOrder: entry.displayOrder })
      .where(eq(menuCategories.id, entry.id));
  }

  return Response.json({ success: true, updated: changes.length });
}

async function applyItemReorder(payload: ItemReorderPayload) {
  const ids = payload.items.map((entry) => entry.id);

  const rows =
    ids.length === 0
      ? []
      : await db
          .select({
            id: menuItems.id,
            categoryId: menuItems.categoryId,
            displayOrder: menuItems.displayOrder,
          })
          .from(menuItems)
          .where(inArray(menuItems.id, ids));

  if (rows.length !== ids.length) {
    return Response.json(
      { error: "One or more menu items could not be found" },
      { status: 400 }
    );
  }

  for (const row of rows) {
    if (row.categoryId !== payload.categoryId) {
      return Response.json(
        { error: "All menu items must belong to the selected category" },
        { status: 400 }
      );
    }
  }

  const displayOrderById = new Map(rows.map((row) => [row.id, row.displayOrder]));
  const changes = payload.items.filter((entry) => {
    const current = displayOrderById.get(entry.id);
    return current === undefined ? false : current !== entry.displayOrder;
  });

  if (changes.length === 0) {
    return Response.json({ success: true, updated: 0 });
  }

  for (const entry of changes) {
    await db
      .update(menuItems)
      .set({ displayOrder: entry.displayOrder })
      .where(
        and(
          eq(menuItems.id, entry.id),
          eq(menuItems.categoryId, payload.categoryId)
        )
      );
  }

  return Response.json({ success: true, updated: changes.length });
}
