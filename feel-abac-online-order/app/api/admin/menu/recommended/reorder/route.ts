import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import { db } from "@/src/db/client";
import { recommendedMenuItems } from "@/src/db/schema";
import {
  RecommendedMenuReorderPayload,
  recommendedMenuReorderSchema,
} from "@/lib/menu/validators";

export const revalidate = 0;

export async function POST(request: NextRequest) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = recommendedMenuReorderSchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Response.json(
      { error: issue?.message ?? "Invalid payload" },
      { status: 400 }
    );
  }

  const payload = parsed.data;

  try {
    const response = await applyRecommendationReorder(payload);
    revalidateTag("public-menu", "default");
    return response;
  } catch (error) {
    console.error("[recommended/reorder] failed", error);
    return Response.json(
      { error: "Failed to update recommendation order" },
      { status: 500 }
    );
  }
}

async function applyRecommendationReorder(
  payload: RecommendedMenuReorderPayload
) {
  const ids = payload.items.map((entry) => entry.id);

  const rows =
    ids.length === 0
      ? []
      : await db
          .select({
            id: recommendedMenuItems.id,
            displayOrder: recommendedMenuItems.displayOrder,
          })
          .from(recommendedMenuItems)
          .where(inArray(recommendedMenuItems.id, ids));

  if (rows.length !== ids.length) {
    return Response.json(
      { error: "One or more recommendations could not be found" },
      { status: 400 }
    );
  }

  const displayOrderById = new Map(
    rows.map((row) => [row.id, row.displayOrder])
  );
  const changes = payload.items.filter((entry) => {
    const current = displayOrderById.get(entry.id);
    return current === undefined ? false : current !== entry.displayOrder;
  });

  if (changes.length === 0) {
    return Response.json({ success: true, updated: 0 });
  }

  for (const entry of changes) {
    await db
      .update(recommendedMenuItems)
      .set({ displayOrder: entry.displayOrder })
      .where(eq(recommendedMenuItems.id, entry.id));
  }

  return Response.json({ success: true, updated: changes.length });
}
