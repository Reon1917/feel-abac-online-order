import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";

import { resolveUserId } from "@/lib/api/require-user";
import { db } from "@/src/db/client";
import { admins, orderEvents, orders } from "@/src/db/schema";
import type { OrderStatus } from "@/lib/orders/types";
import { broadcastOrderStatusChanged, broadcastOrderClosed } from "@/lib/orders/realtime";
import { cleanupTransientEvents } from "@/lib/orders/cleanup";
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
  const validActions = ["accept", "cancel", "delivered"];
  if (!action || !validActions.includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const reason =
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

  if (order.isClosed || order.status === "cancelled" || order.status === "delivered") {
    return NextResponse.json(
      { error: "Order is already closed" },
      { status: 400 }
    );
  }

  const now = new Date();
  
  // Determine next status based on action
  let nextStatus: OrderStatus;
  if (action === "accept") {
    nextStatus = "order_in_kitchen";
  } else if (action === "delivered") {
    nextStatus = "delivered";
  } else {
    nextStatus = "cancelled";
  }

  const updatePayload: Partial<typeof orders.$inferInsert> = {
    status: nextStatus,
    updatedAt: now,
  };

  // Set timestamps based on action
  if (action === "accept") {
    updatePayload.kitchenStartedAt = order.kitchenStartedAt ?? now;
  } else if (action === "delivered") {
    updatePayload.deliveredAt = now;
    updatePayload.isClosed = true;
    updatePayload.closedAt = now;
  } else {
    // cancel
    updatePayload.cancelledAt = now;
    updatePayload.cancelReason = reason;
    updatePayload.isClosed = true;
    updatePayload.closedAt = now;
  }

  await db
    .update(orders)
    .set(updatePayload)
    .where(eq(orders.id, order.id));

  const [insertedEvent] = await db.insert(orderEvents).values({
    orderId: order.id,
    actorType: "admin",
    actorId: userId,
    eventType: "status_updated",
    fromStatus: order.status,
    toStatus: nextStatus,
    metadata: reason ? { reason } : null,
  }).returning({ id: orderEvents.id });

  await broadcastOrderStatusChanged({
    eventId: insertedEvent?.id ?? "",
    orderId: order.id,
    displayId: order.displayId,
    fromStatus: order.status as OrderStatus,
    toStatus: nextStatus,
    actorType: "admin",
    reason,
    at: now.toISOString(),
  });

  // If order is now closed (cancelled or delivered), broadcast close event and cleanup transient events
  const isTerminalState = action === "cancel" || action === "delivered";
  if (isTerminalState) {
    const criticalEventType = action === "cancel" ? "order_cancelled" : "order_delivered";
    
    // Insert critical event for the terminal state
    const [closedEvent] = await db.insert(orderEvents).values({
      orderId: order.id,
      actorType: "admin",
      actorId: userId,
      eventType: criticalEventType,
      fromStatus: order.status,
      toStatus: nextStatus,
      metadata: reason ? { reason } : null,
    }).returning({ id: orderEvents.id });

    // Broadcast order.closed for client channel cleanup
    await broadcastOrderClosed({
      eventId: closedEvent?.id ?? "",
      orderId: order.id,
      displayId: order.displayId,
      finalStatus: nextStatus,
      actorType: "admin",
      reason,
      at: now.toISOString(),
    });

    // Cleanup transient events (keep only critical ones)
    await cleanupTransientEvents(order.id);
  }

  return NextResponse.json({ status: nextStatus });
}
