import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import { db } from "@/src/db/client";
import { menuChoiceOptions } from "@/src/db/schema";
import {
  menuChoiceOptionSchema,
  toDecimalString,
} from "@/lib/menu/validators";

export const revalidate = 0;

export async function GET(request: NextRequest) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const choiceGroupId = searchParams.get("choiceGroupId");

  let query = db
    .select()
    .from(menuChoiceOptions)
    .orderBy(
      asc(menuChoiceOptions.displayOrder),
      asc(menuChoiceOptions.createdAt)
    );

  if (choiceGroupId) {
    query = query.where(eq(menuChoiceOptions.choiceGroupId, choiceGroupId));
  }

  const options = await query;
  return Response.json({ options });
}

export async function POST(request: NextRequest) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const payload = await request.json();
  const parsed = menuChoiceOptionSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 }
    );
  }

  const values = parsed.data;

  const [option] = await db
    .insert(menuChoiceOptions)
    .values({
      id: crypto.randomUUID(),
      choiceGroupId: values.choiceGroupId,
      nameEn: values.nameEn,
      nameMm: values.nameMm ?? null,
      extraPrice: toDecimalString(values.extraPrice ?? 0),
      isAvailable: values.isAvailable ?? true,
      displayOrder: values.displayOrder ?? 0,
    })
    .returning();

  return Response.json({ option }, { status: 201 });
}
