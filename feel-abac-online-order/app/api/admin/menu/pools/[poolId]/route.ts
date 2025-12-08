import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import {
  getChoicePoolById,
  updateChoicePool,
  deleteChoicePool,
} from "@/lib/menu/pool-queries";
import { choicePoolUpdateSchema } from "@/lib/menu/validators";

export const revalidate = 0;

type RouteParams = {
  params: Promise<{ poolId: string }>;
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { poolId } = await params;
  const pool = await getChoicePoolById(poolId.trim());

  if (!pool) {
    return Response.json({ error: "Pool not found" }, { status: 404 });
  }

  return Response.json({ pool });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { poolId } = await params;
  const payload = await request.json();
  const parsed = choicePoolUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 }
    );
  }

  const pool = await updateChoicePool(poolId.trim(), parsed.data);

  if (!pool) {
    return Response.json({ error: "Pool not found" }, { status: 404 });
  }

  revalidateTag("public-menu", "default");

  return Response.json({ pool });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { poolId } = await params;
  const deleted = await deleteChoicePool(poolId.trim());

  if (!deleted) {
    return Response.json({ error: "Pool not found" }, { status: 404 });
  }

  revalidateTag("public-menu", "default");

  return Response.json({ success: true });
}
