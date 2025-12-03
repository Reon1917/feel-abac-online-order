import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";

import { resolveUserId } from "@/lib/api/require-user";
import { requireAdmin } from "@/lib/api/require-admin";
import { db } from "@/src/db/client";
import { orders, orderEvents } from "@/src/db/schema";
import type { OrderPaymentType, OrderStatus } from "@/lib/orders/types";
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

  const body = (await req.json().catch(() => null)) as {
    type?: OrderPaymentType;
    reason?: string;
  } | null;

  const paymentType = body?.type ?? "food";
  const reason =
    typeof body?.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim()
      : null;

  if (paymentType !== "food" && paymentType !== "delivery") {
    return NextResponse.json(
      { error: "Invalid payment type" },
      { status: 400 }
    );
  }

  // Get order by displayId
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.displayId, resolvedParams.displayId))
    .orderBy(desc(orders.createdAt))
    .limit(1);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Verify order is in correct status for rejection
  const expectedStatus: OrderStatus =
    paymentType === "food" ? "food_payment_review" : "delivery_payment_review";

  if (order.status !== expectedStatus) {
    return NextResponse.json(
      { error: `Order is not in ${expectedStatus} status` },
      { status: 400 }
    );
  }

  // Check payment exists and has receipt uploaded
  const payment = await getPaymentForOrder(order.id, paymentType);
  if (!payment || payment.status !== "receipt_uploaded") {
    return NextResponse.json(
      { error: "No receipt uploaded to reject" },
      { status: 400 }
    );
  }

  // Reject the payment
  const updatedPayment = await rejectPayment({
    orderId: order.id,
    type: paymentType,
    reason: reason ?? undefined,
  });

  if (!updatedPayment) {
    return NextResponse.json(
      { error: "Failed to reject payment" },
      { status: 500 }
    );
  }

  // Move order back to awaiting payment status
  const newStatus: OrderStatus =
    paymentType === "food"
      ? "awaiting_food_payment"
      : "awaiting_delivery_fee_payment";

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
        paymentType,
        reason,
        rejectionCount: updatedPayment.rejectionCount,
      },
    })
    .returning({ id: orderEvents.id });

  // Broadcast to customer channel
  await broadcastPaymentRejected({
    eventId: insertedEvent?.id ?? "",
    orderId: order.id,
    displayId: order.displayId,
    paymentType,
    reason,
    rejectionCount: updatedPayment.rejectionCount,
    at: now.toISOString(),
  });

  // Also broadcast status change so admin + diner views update
  await broadcastOrderStatusChanged({
    eventId: insertedEvent?.id ?? "",
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
