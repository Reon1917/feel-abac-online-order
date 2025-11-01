import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import { db } from "@/src/db/client";
import { menuChoiceGroups } from "@/src/db/schema";
import { menuChoiceGroupSchema } from "@/lib/menu/validators";

export const revalidate = 0;

export async function GET(request: NextRequest) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const menuItemId = searchParams.get("menuItemId");

  let query = db
    .select()
    .from(menuChoiceGroups)
    .orderBy(
      asc(menuChoiceGroups.displayOrder),
      asc(menuChoiceGroups.createdAt)
    );

  if (menuItemId) {
    query = query.where(eq(menuChoiceGroups.menuItemId, menuItemId));
  }

  const groups = await query;
  return Response.json({ groups });
}

export async function POST(request: NextRequest) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const payload = await request.json();
  const parsed = menuChoiceGroupSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 }
    );
  }

  const values = parsed.data;

  if (values.maxSelect < values.minSelect) {
    return Response.json(
      { error: "Max select must be greater than or equal to min select" },
      { status: 400 }
    );
  }

  const [group] = await db
    .insert(menuChoiceGroups)
    .values({
      id: crypto.randomUUID(),
      menuItemId: values.menuItemId,
      titleEn: values.titleEn,
      titleMm: values.titleMm ?? null,
      minSelect: values.minSelect ?? 0,
      maxSelect: values.maxSelect,
      isRequired: values.isRequired ?? false,
      displayOrder: values.displayOrder ?? 0,
      type: values.type ?? "single",
    })
    .returning();

  return Response.json({ group }, { status: 201 });
}
