import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";

import { resolveUserId } from "@/lib/api/require-user";
import { requireAdmin } from "@/lib/api/require-admin";
import { db } from "@/src/db/client";
import { orders, orderEvents } from "@/src/db/schema";
import type { OrderStatus } from "@/lib/orders/types";
import {
  getPaymentForOrder,
  rejectPayment,
  updateOrderStatusForPayment,
} from "@/lib/payments/receipt-queries";
import {
  broadcastPaymentRejected,
  broadcastOrderStatusChanged,
} from "@/lib/orders/realtime";

type Params = {
  displayId: string;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const resolvedParams = await params;
  const userId = await resolveUserId(req);

  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminRow = await requireAdmin(userId);
  if (!adminRow) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Trim and validate displayId per AGENTS.md
  const displayId = (resolvedParams.displayId ?? "").trim();
  if (!displayId) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as {
    reason?: string;
  } | null;

  const reason =
    typeof body?.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim()
      : null;

  // Get order by displayId
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.displayId, displayId))
    .orderBy(desc(orders.createdAt))
    .limit(1);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Verify order is in payment_review status
  if (order.status !== "payment_review") {
    return NextResponse.json(
      { error: "Order is not in payment review status" },
      { status: 400 }
    );
  }

  // Get combined payment
  const payment = await getPaymentForOrder(order.id, "combined");

  if (!payment || payment.status !== "receipt_uploaded") {
    return NextResponse.json(
      { error: "No receipt uploaded to reject" },
      { status: 400 }
    );
  }

  // Reject the payment
  const updatedPayment = await rejectPayment({
    orderId: order.id,
    type: "combined",
    reason: reason ?? undefined,
  });

  if (!updatedPayment) {
    return NextResponse.json(
      { error: "Failed to reject payment" },
      { status: 500 }
    );
  }

  const newStatus: OrderStatus = "awaiting_payment";

  await updateOrderStatusForPayment(order.id, newStatus);

  const now = new Date();

  // Record event
  const [insertedEvent] = await db
    .insert(orderEvents)
    .values({
      orderId: order.id,
      actorType: "admin",
      actorId: userId,
      eventType: "payment_rejected",
      fromStatus: order.status,
      toStatus: newStatus,
      metadata: {
        paymentType: "combined",
        reason,
        rejectionCount: updatedPayment.rejectionCount,
      },
    })
    .returning({ id: orderEvents.id });

  const baseEventId = insertedEvent?.id ?? crypto.randomUUID();

  // Broadcast to customer channel
  await broadcastPaymentRejected({
    eventId: `${baseEventId}-rejection`,
    orderId: order.id,
    displayId: order.displayId,
    paymentType: "combined",
    reason,
    rejectionCount: updatedPayment.rejectionCount,
    at: now.toISOString(),
  });

  // Also broadcast status change so admin + diner views update
  await broadcastOrderStatusChanged({
    eventId: `${baseEventId}-status`,
    orderId: order.id,
    displayId: order.displayId,
    fromStatus: order.status as OrderStatus,
    toStatus: newStatus,
    actorType: "admin",
    at: now.toISOString(),
  });

  return NextResponse.json({
    status: newStatus,
    rejectionCount: updatedPayment.rejectionCount,
  });
}
