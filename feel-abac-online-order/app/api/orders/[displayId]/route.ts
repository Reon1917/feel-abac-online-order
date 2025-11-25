import { NextResponse, type NextRequest } from "next/server";

import { getOrderByDisplayId } from "@/lib/orders/queries";
import { getSession } from "@/lib/session";

type Params = {
  displayId: string;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Params }
) {
  const session = await getSession();
  const viewerUserId = session?.session?.user.id;
  const isAdmin = session?.isAdmin === true;

  const order = await getOrderByDisplayId(params.displayId, {
    userId: viewerUserId,
    isAdmin,
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ order });
}
