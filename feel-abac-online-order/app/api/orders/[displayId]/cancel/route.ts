import { NextResponse, type NextRequest } from "next/server";
import { eq, desc, and } from "drizzle-orm";

import { resolveUserId } from "@/lib/api/require-user";
import { db } from "@/src/db/client";
import { orderEvents, orderPayments, orders } from "@/src/db/schema";
import { broadcastOrderClosed, broadcastOrderStatusChanged } from "@/lib/orders/realtime";
import { cleanupTransientEvents } from "@/lib/orders/cleanup";
import type { OrderStatus } from "@/lib/orders/types";

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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { reason?: string | null }
    | null;
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

  if (order.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (order.isClosed || order.status === "cancelled" || order.status === "delivered") {
    return NextResponse.json({ error: "Order is already closed" }, { status: 400 });
  }

  const [foodPayment] = await db
    .select()
    .from(orderPayments)
    .where(
      and(eq(orderPayments.orderId, order.id), eq(orderPayments.type, "food"))
    )
    .limit(1);

  const receiptUploaded =
    foodPayment?.receiptUploadedAt ||
    (foodPayment && foodPayment.status && foodPayment.status !== "pending");

  const canCancel =
    process.env.NODE_ENV !== "production"
      ? true
      : order.status === "order_processing" ||
        (order.status === "awaiting_food_payment" && !receiptUploaded);

  if (!canCancel) {
    return NextResponse.json(
      { error: "Cancellation window has passed" },
      { status: 400 }
    );
  }

  const now = new Date();
  const nextStatus: OrderStatus = "cancelled";

  await db
    .update(orders)
    .set({
      status: nextStatus,
      cancelledAt: now,
      cancelReason: reason,
      isClosed: true,
      closedAt: now,
      updatedAt: now,
    })
    .where(eq(orders.id, order.id));

  const [statusEvent] = await db
    .insert(orderEvents)
    .values({
      orderId: order.id,
      actorType: "user",
      actorId: userId,
      eventType: "status_updated",
      fromStatus: order.status,
      toStatus: nextStatus,
      metadata: reason ? { reason } : null,
    })
    .returning({ id: orderEvents.id });

  const eventId = statusEvent?.id;
  if (!eventId) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[orders/cancel] missing event id", {
        orderId: order.id,
        displayId: order.displayId,
        reason,
      });
    }
    throw new Error("Failed to record cancellation event");
  }

  await broadcastOrderStatusChanged({
    eventId,
    orderId: order.id,
    displayId: order.displayId,
    fromStatus: order.status as OrderStatus,
    toStatus: nextStatus,
    actorType: "user",
    reason,
    at: now.toISOString(),
  });

  const [closedEvent] = await db
    .insert(orderEvents)
    .values({
      orderId: order.id,
      actorType: "user",
      actorId: userId,
      eventType: "order_cancelled",
      fromStatus: order.status,
      toStatus: nextStatus,
      metadata: reason ? { reason } : null,
    })
    .returning({ id: orderEvents.id });

  await broadcastOrderClosed({
    eventId: closedEvent?.id ?? "",
    orderId: order.id,
    displayId: order.displayId,
    finalStatus: nextStatus,
    actorType: "user",
    reason,
    at: now.toISOString(),
  });

  await cleanupTransientEvents(order.id);

  return NextResponse.json({
    status: nextStatus,
    cancelledAt: now.toISOString(),
    reason,
  });
}
