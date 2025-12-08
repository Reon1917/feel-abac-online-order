import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import { reorderPools } from "@/lib/menu/pool-queries";
import { poolReorderSchema } from "@/lib/menu/validators";

export const revalidate = 0;

export async function POST(request: NextRequest) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const payload = await request.json();
  const parsed = poolReorderSchema.safeParse(payload);

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 }
    );
  }

  await reorderPools(parsed.data.orderedIds);

  revalidateTag("public-menu", "default");

  return Response.json({ success: true });
}
