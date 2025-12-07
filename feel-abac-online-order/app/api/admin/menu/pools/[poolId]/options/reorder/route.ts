import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import { reorderPoolOptions } from "@/lib/menu/pool-queries";
import { poolReorderSchema } from "@/lib/menu/validators";

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
  const payload = await request.json();
  const parsed = poolReorderSchema.safeParse(payload);

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 }
    );
  }

  await reorderPoolOptions(poolId.trim(), parsed.data.orderedIds);

  revalidateTag("public-menu");

  return Response.json({ success: true });
}
