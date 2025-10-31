import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import { db } from "@/src/db/client";
import { menuChoiceOptions } from "@/src/db/schema";
import {
  menuChoiceOptionUpdateSchema,
  toDecimalString,
} from "@/lib/menu/validators";

type RouteParams = {
  params: {
    optionId: string;
  };
};

export const revalidate = 0;

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
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
    .where(eq(menuChoiceOptions.id, params.optionId))
    .returning();

  if (!option) {
    return Response.json({ error: "Choice option not found" }, { status: 404 });
  }

  return Response.json({ option });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const [option] = await db
    .delete(menuChoiceOptions)
    .where(eq(menuChoiceOptions.id, params.optionId))
    .returning();

  if (!option) {
    return Response.json({ error: "Choice option not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
