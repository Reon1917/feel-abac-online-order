import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import {
  updatePoolOption,
  deletePoolOption,
} from "@/lib/menu/pool-queries";
import { choicePoolOptionUpdateSchema } from "@/lib/menu/validators";

export const revalidate = 0;

type RouteParams = {
  params: Promise<{ poolId: string; optionId: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { optionId } = await params;
  const payload = await request.json();
  const parsed = choicePoolOptionUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 }
    );
  }

  const option = await updatePoolOption(optionId.trim(), parsed.data);

  if (!option) {
    return Response.json({ error: "Option not found" }, { status: 404 });
  }

  revalidateTag("public-menu");

  return Response.json({ option });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { optionId } = await params;
  const deleted = await deletePoolOption(optionId.trim());

  if (!deleted) {
    return Response.json({ error: "Option not found" }, { status: 404 });
  }

  revalidateTag("public-menu");

  return Response.json({ success: true });
}
