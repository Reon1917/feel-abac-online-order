import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";

import { resolveUserId } from "@/lib/api/require-user";
import { requireAdmin } from "@/lib/api/require-admin";
import { db } from "@/src/db/client";
import { orders, orderEvents } from "@/src/db/schema";
import type { OrderPaymentType, OrderStatus } from "@/lib/orders/types";
import {
  getPaymentForOrder,
  verifyPayment,
  updateOrderStatusForPayment,
} from "@/lib/payments/receipt-queries";
import {
  broadcastPaymentVerified,
  broadcastOrderStatusChanged,
  broadcastOrderClosed,
} from "@/lib/orders/realtime";
import { cleanupTransientEvents } from "@/lib/orders/cleanup";

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
  } | null;

  const paymentType = body?.type ?? "food";

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

  // Verify order is in correct status for verification
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
      { error: "No receipt uploaded for verification" },
      { status: 400 }
    );
  }

  // Verify the payment
  const updatedPayment = await verifyPayment({
    orderId: order.id,
    type: paymentType,
    verifiedByAdminId: adminRow.id,
  });

  if (!updatedPayment) {
    return NextResponse.json(
      { error: "Failed to verify payment" },
      { status: 500 }
    );
  }

  // Determine new order status
  const newStatus: OrderStatus =
    paymentType === "food" ? "order_in_kitchen" : "delivered";

  // Update order status
  await updateOrderStatusForPayment(order.id, newStatus);

  const now = new Date();

  // Record event
  const [insertedEvent] = await db
    .insert(orderEvents)
    .values({
      orderId: order.id,
      actorType: "admin",
      actorId: userId,
      eventType: "payment_verified",
      fromStatus: order.status,
      toStatus: newStatus,
      metadata: { paymentType, verifiedByAdminId: adminRow.id },
    })
    .returning({ id: orderEvents.id });

  // Broadcast payment verified
  await broadcastPaymentVerified({
    eventId: insertedEvent?.id ?? "",
    orderId: order.id,
    displayId: order.displayId,
    paymentType,
    verifiedByAdminId: adminRow.id,
    newStatus,
    at: now.toISOString(),
  });

  // Also broadcast status change for order list updates
  await broadcastOrderStatusChanged({
    eventId: insertedEvent?.id ?? "",
    orderId: order.id,
    displayId: order.displayId,
    fromStatus: order.status as OrderStatus,
    toStatus: newStatus,
    actorType: "admin",
    at: now.toISOString(),
  });

  // If delivery fee payment is verified, close the order
  if (paymentType === "delivery") {
    await broadcastOrderClosed({
      eventId: insertedEvent?.id ?? "",
      orderId: order.id,
      displayId: order.displayId,
      finalStatus: newStatus,
      actorType: "admin",
      at: now.toISOString(),
    });

    await cleanupTransientEvents(order.id);
  }

  return NextResponse.json({ status: newStatus });
}
