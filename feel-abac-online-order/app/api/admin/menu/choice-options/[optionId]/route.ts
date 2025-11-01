import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import { db } from "@/src/db/client";
import { menuChoiceOptions } from "@/src/db/schema";
import {
  menuChoiceOptionUpdateSchema,
  toDecimalString,
} from "@/lib/menu/validators";

export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    optionId: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { optionId: rawOptionId } = await context.params;
  const optionId = rawOptionId?.trim();
  if (!optionId) {
    return Response.json({ error: "Choice option ID is required" }, { status: 400 });
  }

  const payload = await request.json();
  const parsed = menuChoiceOptionUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 }
    );
  }

  const updates = parsed.data;

  const updateData: Partial<typeof menuChoiceOptions.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (updates.choiceGroupId !== undefined) {
    updateData.choiceGroupId = updates.choiceGroupId;
  }
  if (updates.nameEn !== undefined) {
    updateData.nameEn = updates.nameEn;
  }
  if (updates.nameMm !== undefined) {
    updateData.nameMm = updates.nameMm ?? null;
  }
  if (updates.extraPrice !== undefined) {
    updateData.extraPrice = toDecimalString(updates.extraPrice);
  }
  if (updates.isAvailable !== undefined) {
    updateData.isAvailable = updates.isAvailable;
  }
  if (updates.displayOrder !== undefined) {
    updateData.displayOrder = updates.displayOrder;
  }

  const [option] = await db
    .update(menuChoiceOptions)
    .set(updateData)
    .where(eq(menuChoiceOptions.id, optionId))
    .returning();

  if (!option) {
    return Response.json({ error: "Choice option not found" }, { status: 404 });
  }

  return Response.json({ option });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { optionId: rawOptionId } = await context.params;
  const optionId = rawOptionId?.trim();
  if (!optionId) {
    return Response.json({ error: "Choice option ID is required" }, { status: 400 });
  }

  const [option] = await db
    .delete(menuChoiceOptions)
    .where(eq(menuChoiceOptions.id, optionId))
    .returning();

  if (!option) {
    return Response.json({ error: "Choice option not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
