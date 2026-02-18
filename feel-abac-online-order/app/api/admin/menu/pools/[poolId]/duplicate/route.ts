import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { requireMenuAccess } from "@/lib/api/admin-guard";
import { duplicateChoicePool } from "@/lib/menu/pool-queries";
import { choicePoolUpdateSchema } from "@/lib/menu/validators";

export const revalidate = 0;

type RouteParams = {
  params: Promise<{ poolId: string }>;
};

export async function POST(request: NextRequest, { params }: RouteParams) {
  const result = await requireMenuAccess();
  if (!result) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { poolId: rawPoolId } = await params;
  const poolId = rawPoolId?.trim();
  if (!poolId) {
    return Response.json({ error: "Pool ID is required" }, { status: 400 });
  }

  const payload = await request.json().catch(() => ({}));
  const parsed = choicePoolUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 }
    );
  }

  const duplicatedPool = await duplicateChoicePool(poolId, {
    nameEn: parsed.data.nameEn,
    nameMm: parsed.data.nameMm ?? undefined,
    isActive: parsed.data.isActive,
  });

  if (!duplicatedPool) {
    return Response.json({ error: "Pool not found" }, { status: 404 });
  }

  revalidateTag("public-menu", "default");

  return Response.json({ pool: duplicatedPool }, { status: 201 });
}
