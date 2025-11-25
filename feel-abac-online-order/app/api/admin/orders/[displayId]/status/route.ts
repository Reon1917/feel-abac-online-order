import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";

import { getSession } from "@/lib/session";
import { db } from "@/src/db/client";
import { orderEvents, orders } from "@/src/db/schema";
import type { OrderStatus } from "@/lib/orders/types";
import { broadcastOrderStatusChanged } from "@/lib/orders/realtime";

type Params = {
  displayId: string;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Params }
) {
  const session = await getSession();
  if (!session?.isAdmin || !session.session?.user?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { action?: string; reason?: string }
    | null;

  const action = body?.action;
  if (action !== "accept" && action !== "cancel") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const cancelReason =
    typeof body?.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim()
      : null;

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.displayId, params.displayId))
    .orderBy(desc(orders.createdAt))
    .limit(1);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.isClosed || order.status === "cancelled") {
    return NextResponse.json(
      { error: "Order is already closed" },
      { status: 400 }
    );
  }

  const now = new Date();
  const nextStatus: OrderStatus =
    action === "accept" ? "order_in_kitchen" : "cancelled";

  const updatePayload: Partial<typeof orders.$inferInsert> = {
    status: nextStatus,
    updatedAt: now,
  };

  if (action === "accept") {
    updatePayload.kitchenStartedAt = order.kitchenStartedAt ?? now;
  } else {
    updatePayload.cancelledAt = now;
    updatePayload.cancelReason = cancelReason;
    updatePayload.isClosed = true;
    updatePayload.closedAt = now;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set(updatePayload)
      .where(eq(orders.id, order.id));

    await tx.insert(orderEvents).values({
      orderId: order.id,
      actorType: "admin",
      actorId: session.session.user.id,
      eventType: "status_updated",
      fromStatus: order.status,
      toStatus: nextStatus,
      metadata: cancelReason ? { reason: cancelReason } : null,
    });
  });

  await broadcastOrderStatusChanged({
    orderId: order.id,
    displayId: order.displayId,
    fromStatus: order.status as OrderStatus,
    toStatus: nextStatus,
    actorType: "admin",
    reason: cancelReason,
    at: now.toISOString(),
  });

  return NextResponse.json({ status: nextStatus });
}
