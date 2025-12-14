import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import crypto from "node:crypto";
import { asc } from "drizzle-orm";
import { requireActiveAdmin, requireMenuAccess } from "@/lib/api/admin-guard";
import { db } from "@/src/db/client";
import { menuCategories } from "@/src/db/schema";
import { menuCategorySchema } from "@/lib/menu/validators";

export const revalidate = 0;

export async function GET() {
  const result = await requireActiveAdmin();
  if (!result) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const categories = await db
    .select()
    .from(menuCategories)
    .orderBy(asc(menuCategories.displayOrder), asc(menuCategories.createdAt));

  return Response.json({ categories });
}

export async function POST(request: NextRequest) {
  const result = await requireMenuAccess();
  if (!result) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json();
  const parsed = menuCategorySchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 }
    );
  }

  const values = parsed.data;

  const [category] = await db
    .insert(menuCategories)
    .values({
      id: crypto.randomUUID(),
      nameEn: values.nameEn,
      nameMm: values.nameMm ?? null,
      displayOrder: values.displayOrder ?? 0,
      isActive: values.isActive ?? true,
    })
    .returning();

  revalidateTag("public-menu", "default");

  return Response.json({ category }, { status: 201 });
}
