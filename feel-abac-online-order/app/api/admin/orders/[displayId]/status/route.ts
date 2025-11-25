import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";

import { resolveUserId } from "@/lib/api/require-user";
import { db } from "@/src/db/client";
import { admins, orderEvents, orders } from "@/src/db/schema";
import type { OrderStatus } from "@/lib/orders/types";
import { broadcastOrderStatusChanged } from "@/lib/orders/realtime";
import { eq as eqOp } from "drizzle-orm";

type Params = {
  displayId: string;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const resolvedParams = await params;
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminRow =
    (await db
      .select({ id: admins.id })
      .from(admins)
      .where(eqOp(admins.userId, userId))
      .limit(1))[0] ?? null;

  if (!adminRow) {
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
    .where(eq(orders.displayId, resolvedParams.displayId))
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

  await db
    .update(orders)
    .set(updatePayload)
    .where(eq(orders.id, order.id));

  await db.insert(orderEvents).values({
    orderId: order.id,
    actorType: "admin",
    actorId: userId,
    eventType: "status_updated",
    fromStatus: order.status,
    toStatus: nextStatus,
    metadata: cancelReason ? { reason: cancelReason } : null,
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
