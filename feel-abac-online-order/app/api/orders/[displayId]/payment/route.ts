import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";

import { resolveUserId } from "@/lib/api/require-user";
import { db } from "@/src/db/client";
import { orders, orderEvents } from "@/src/db/schema";
import type { OrderPaymentType, OrderStatus } from "@/lib/orders/types";
import {
  canUploadReceipt,
  markReceiptUploaded,
  updateOrderStatusForPayment,
} from "@/lib/payments/receipt-queries";
import { broadcastPaymentReceiptUploaded } from "@/lib/orders/realtime";

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

  const body = (await req.json().catch(() => null)) as {
    type?: OrderPaymentType;
    receiptUrl?: string;
  } | null;

  if (!body?.type || !body?.receiptUrl) {
    return NextResponse.json(
      { error: "Missing type or receiptUrl" },
      { status: 400 }
    );
  }

  const paymentType = body.type;
  const receiptUrl = body.receiptUrl;

  // Validate payment type
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

  // Verify user owns this order
  if (order.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check if order is in correct status for receipt upload
  const validStatuses: OrderStatus[] = ["awaiting_food_payment"];
  if (paymentType === "delivery") {
    validStatuses.push("awaiting_delivery_fee_payment");
  }

  if (!validStatuses.includes(order.status as OrderStatus)) {
    return NextResponse.json(
      { error: "Order is not awaiting payment" },
      { status: 400 }
    );
  }

  // Check if can upload (rejection count limit)
  const uploadCheck = await canUploadReceipt(order.id, paymentType);
  if (!uploadCheck.allowed) {
    return NextResponse.json({ error: uploadCheck.reason }, { status: 400 });
  }

  // Update payment record
  const updatedPayment = await markReceiptUploaded({
    orderId: order.id,
    type: paymentType,
    receiptUrl,
  });

  if (!updatedPayment) {
    return NextResponse.json(
      { error: "Failed to update payment" },
      { status: 500 }
    );
  }

  // Determine new order status
  const newStatus: OrderStatus =
    paymentType === "food" ? "food_payment_review" : "delivery_payment_review";

  // Update order status
  await updateOrderStatusForPayment(order.id, newStatus);

  // Record event
  const [insertedEvent] = await db
    .insert(orderEvents)
    .values({
      orderId: order.id,
      actorType: "user",
      actorId: userId,
      eventType: "payment_receipt_uploaded",
      fromStatus: order.status,
      toStatus: newStatus,
      metadata: { paymentType, receiptUrl },
    })
    .returning({ id: orderEvents.id });

  // Broadcast to admin and order channel
  await broadcastPaymentReceiptUploaded({
    eventId: insertedEvent?.id ?? "",
    orderId: order.id,
    displayId: order.displayId,
    paymentType,
    receiptUrl,
    at: new Date().toISOString(),
  });

  return NextResponse.json({
    status: newStatus,
    payment: {
      id: updatedPayment.id,
      status: updatedPayment.status,
      receiptUrl: updatedPayment.receiptUrl,
      receiptUploadedAt: updatedPayment.receiptUploadedAt?.toISOString(),
    },
  });
}

