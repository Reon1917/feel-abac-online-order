import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { requireActiveAdmin, requireMenuAccess } from "@/lib/api/admin-guard";
import {
  getAllChoicePools,
  createChoicePool,
} from "@/lib/menu/pool-queries";
import { choicePoolSchema } from "@/lib/menu/validators";

export const revalidate = 0;

export async function GET() {
  const result = await requireActiveAdmin();
  if (!result) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const pools = await getAllChoicePools();
  return Response.json({ pools });
}

export async function POST(request: NextRequest) {
  const result = await requireMenuAccess();
  if (!result) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json();
  const parsed = choicePoolSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 }
    );
  }

  const pool = await createChoicePool({
    nameEn: parsed.data.nameEn,
    nameMm: parsed.data.nameMm ?? null,
    isActive: parsed.data.isActive ?? true,
    displayOrder: parsed.data.displayOrder ?? 0,
  });

  revalidateTag("public-menu", "default");

  return Response.json({ pool }, { status: 201 });
}
