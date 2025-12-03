import { eq, and } from "drizzle-orm";

import { db } from "@/src/db/client";
import { orderPayments, orders } from "@/src/db/schema";
import type { OrderPaymentStatus, OrderPaymentType } from "@/lib/orders/types";

const MAX_REJECTION_COUNT = 10;

export async function getPaymentForOrder(
  orderId: string,
  type: OrderPaymentType
) {
  const [payment] = await db
    .select()
    .from(orderPayments)
    .where(
      and(eq(orderPayments.orderId, orderId), eq(orderPayments.type, type))
    )
    .limit(1);

  return payment ?? null;
}

export async function canUploadReceipt(
  orderId: string,
  type: OrderPaymentType
): Promise<{ allowed: boolean; reason?: string }> {
  const payment = await getPaymentForOrder(orderId, type);

  if (!payment) {
    return { allowed: false, reason: "Payment not found" };
  }

  if (payment.rejectionCount >= MAX_REJECTION_COUNT) {
    return {
      allowed: false,
      reason: "Maximum upload attempts reached. Please contact support.",
    };
  }

  // Can only upload if pending or rejected (re-upload)
  if (payment.status !== "pending" && payment.status !== "rejected") {
    return { allowed: false, reason: "Receipt already uploaded" };
  }

  return { allowed: true };
}

export async function markReceiptUploaded(input: {
  orderId: string;
  type: OrderPaymentType;
  receiptUrl: string;
}) {
  const now = new Date();

  const [updated] = await db
    .update(orderPayments)
    .set({
      receiptUrl: input.receiptUrl,
      receiptUploadedAt: now,
      status: "receipt_uploaded" as OrderPaymentStatus,
      rejectedReason: null, // Clear previous rejection reason
      updatedAt: now,
    })
    .where(
      and(
        eq(orderPayments.orderId, input.orderId),
        eq(orderPayments.type, input.type)
      )
    )
    .returning();

  return updated ?? null;
}

export async function verifyPayment(input: {
  orderId: string;
  type: OrderPaymentType;
  verifiedByAdminId: string;
}) {
  const now = new Date();

  const [updated] = await db
    .update(orderPayments)
    .set({
      status: "verified" as OrderPaymentStatus,
      verifiedAt: now,
      verifiedByAdminId: input.verifiedByAdminId,
      updatedAt: now,
    })
    .where(
      and(
        eq(orderPayments.orderId, input.orderId),
        eq(orderPayments.type, input.type)
      )
    )
    .returning();

  return updated ?? null;
}

export async function rejectPayment(input: {
  orderId: string;
  type: OrderPaymentType;
  reason?: string;
}) {
  const now = new Date();

  // Get current rejection count
  const payment = await getPaymentForOrder(input.orderId, input.type);
  if (!payment) return null;

  const newRejectionCount = (payment.rejectionCount ?? 0) + 1;

  const [updated] = await db
    .update(orderPayments)
    .set({
      status: "rejected" as OrderPaymentStatus,
      rejectedReason: input.reason ?? null,
      rejectionCount: newRejectionCount,
      updatedAt: now,
    })
    .where(
      and(
        eq(orderPayments.orderId, input.orderId),
        eq(orderPayments.type, input.type)
      )
    )
    .returning();

  return updated ?? null;
}

export async function updateOrderStatusForPayment(
  orderId: string,
  newStatus: string
) {
  const now = new Date();
  const updatePayload: Partial<typeof orders.$inferInsert> = {
    status: newStatus,
    updatedAt: now,
  };

  if (newStatus === "order_in_kitchen") {
    updatePayload.kitchenStartedAt = now;
  }

  if (newStatus === "order_out_for_delivery") {
    updatePayload.outForDeliveryAt = now;
  }

  if (newStatus === "delivered") {
    updatePayload.deliveredAt = now;
    updatePayload.isClosed = true;
    updatePayload.closedAt = now;
  }

  await db.update(orders).set(updatePayload).where(eq(orders.id, orderId));
}
