import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { getOrderByDisplayId } from "@/lib/orders/queries";
import { resolveUserId } from "@/lib/api/require-user";
import { db } from "@/src/db/client";
import { admins } from "@/src/db/schema";

type Params = {
  displayId: string;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const resolvedParams = await params;
  const viewerUserId = await resolveUserId(_req);

  const adminRow =
    viewerUserId &&
    (await db
      .select({ id: admins.id })
      .from(admins)
      .where(eq(admins.userId, viewerUserId))
      .limit(1))[0];

  const isAdmin = Boolean(adminRow);

  const order = await getOrderByDisplayId(resolvedParams.displayId, {
    userId: viewerUserId,
    isAdmin,
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ order });
}
