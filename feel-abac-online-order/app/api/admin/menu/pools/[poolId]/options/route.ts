import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import {
  getChoicePoolById,
  addPoolOption,
} from "@/lib/menu/pool-queries";
import { choicePoolOptionSchema } from "@/lib/menu/validators";

export const revalidate = 0;

type RouteParams = {
  params: Promise<{ poolId: string }>;
};

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { poolId } = await params;
  const trimmedPoolId = poolId.trim();

  // Verify pool exists
  const pool = await getChoicePoolById(trimmedPoolId);
  if (!pool) {
    return Response.json({ error: "Pool not found" }, { status: 404 });
  }

  const payload = await request.json();
  const parsed = choicePoolOptionSchema.safeParse({
    ...payload,
    poolId: trimmedPoolId,
  });

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 }
    );
  }

  const option = await addPoolOption(trimmedPoolId, {
    menuCode: parsed.data.menuCode ?? null,
    nameEn: parsed.data.nameEn,
    nameMm: parsed.data.nameMm ?? null,
    price: parsed.data.price ?? 0,
    isAvailable: parsed.data.isAvailable ?? true,
    displayOrder: parsed.data.displayOrder ?? 0,
  });

  revalidateTag("public-menu");

  return Response.json({ option }, { status: 201 });
}
