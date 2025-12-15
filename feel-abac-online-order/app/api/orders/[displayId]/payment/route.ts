import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";

import { resolveUserId } from "@/lib/api/require-user";
import { db } from "@/src/db/client";
import { orders, orderEvents } from "@/src/db/schema";
import type { OrderStatus } from "@/lib/orders/types";
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

  // Trim and validate displayId per AGENTS.md
  const displayId = (resolvedParams.displayId ?? "").trim();
  if (!displayId) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as {
    receiptUrl?: string;
  } | null;

  if (!body?.receiptUrl) {
    return NextResponse.json(
      { error: "Missing receiptUrl" },
      { status: 400 }
    );
  }

  const receiptUrl = body.receiptUrl;

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

  // Verify user owns this order
  if (order.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check if order is awaiting payment
  if (order.status !== "awaiting_payment") {
    return NextResponse.json(
      { error: "Order is not awaiting payment" },
      { status: 400 }
    );
  }

  // Check if can upload (rejection count limit)
  const uploadCheck = await canUploadReceipt(order.id, "combined");
  if (!uploadCheck.allowed) {
    return NextResponse.json({ error: uploadCheck.reason }, { status: 400 });
  }

  // Update payment record
  const updatedPayment = await markReceiptUploaded({
    orderId: order.id,
    type: "combined",
    receiptUrl,
  });

  if (!updatedPayment) {
    return NextResponse.json(
      { error: "Failed to update payment" },
      { status: 500 }
    );
  }

  const newStatus: OrderStatus = "payment_review";

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
      metadata: { paymentType: "combined", receiptUrl },
    })
    .returning({ id: orderEvents.id });

  // Broadcast to admin and order channel
  await broadcastPaymentReceiptUploaded({
    eventId: insertedEvent?.id ?? "",
    orderId: order.id,
    displayId: order.displayId,
    paymentType: "combined",
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
