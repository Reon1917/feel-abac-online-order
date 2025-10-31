import { requireActiveAdmin } from "@/lib/api/admin-guard";
import { getAdminMenuHierarchy } from "@/lib/menu/queries";

export const revalidate = 0;

export async function GET() {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const menu = await getAdminMenuHierarchy();
  return Response.json({ menu });
}
