import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";

import { resolveUserId } from "@/lib/api/require-user";
import { requireAdmin } from "@/lib/api/require-admin";
import { db } from "@/src/db/client";
import { orderEvents, orderPayments, orders } from "@/src/db/schema";
import type { OrderStatus } from "@/lib/orders/types";
import {
  broadcastOrderStatusChanged,
  broadcastOrderClosed,
} from "@/lib/orders/realtime";
import { cleanupTransientEvents } from "@/lib/orders/cleanup";
import { buildPromptPayPayload } from "@/lib/payments/promptpay";
import { getActivePromptPayAccount } from "@/lib/payments/queries";

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

  const adminRow = await requireAdmin(userId);

  if (!adminRow) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        action?: string;
        reason?: string;
        courierVendor?: string;
        courierTrackingUrl?: string;
        deliveryFee?: number | string;
      }
    | null;

  const action = body?.action;
  const validActions = ["accept", "cancel", "handed_off", "delivered"];
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

  const devOverride = process.env.NODE_ENV !== "production";
  if (
    order.isClosed ||
    order.status === "cancelled" ||
    order.status === "delivered"
  ) {
    if (!(devOverride && action === "cancel")) {
      return NextResponse.json(
        { error: "Order is already closed" },
        { status: 400 }
      );
    }
  }

  const now = new Date();

  // Determine next status based on action
  let nextStatus: OrderStatus;
  if (action === "accept") {
    if (order.status !== "order_processing") {
      return NextResponse.json(
        { error: "Order is already accepted" },
        { status: 400 }
      );
    }

    // Parse delivery fee from request body (required for combined payment flow)
    const rawDeliveryFee = body?.deliveryFee;
    const deliveryFee =
      typeof rawDeliveryFee === "number"
        ? rawDeliveryFee
        : typeof rawDeliveryFee === "string"
          ? Number(rawDeliveryFee)
          : NaN;

    if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
      return NextResponse.json(
        { error: "Delivery fee is required (can be 0 for pickup)" },
        { status: 400 }
      );
    }

    const activeAccount = await getActivePromptPayAccount();
    if (!activeAccount) {
      return NextResponse.json(
        { error: "Activate a PromptPay account before accepting orders" },
        { status: 400 }
      );
    }

    // Calculate combined total (food + delivery fee)
    const foodTotal = Number(order.subtotal ?? 0);
    const combinedTotal = foodTotal + Math.round(deliveryFee);

    // Update order with delivery fee and new total amount
    await db
      .update(orders)
      .set({
        deliveryFee: String(Math.round(deliveryFee)),
        totalAmount: String(combinedTotal),
        updatedAt: now,
      })
      .where(eq(orders.id, order.id));

    const { payload, normalizedPhone, amount } = buildPromptPayPayload({
      phoneNumber: activeAccount.phoneNumber,
      amount: combinedTotal,
    });

    const promptParseData = JSON.stringify({
      phoneNumber: normalizedPhone,
      amount,
      accountId: activeAccount.id,
    });

    // Create combined payment record
    await db
      .insert(orderPayments)
      .values({
        orderId: order.id,
        promptpayAccountId: activeAccount.id,
        type: "combined",
        amount: amount.toFixed(2),
        status: "pending",
        qrPayload: payload,
        promptParseData,
        requestedByAdminId: adminRow.id,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [orderPayments.orderId, orderPayments.type],
        set: {
          amount: amount.toFixed(2),
          status: "pending",
          qrPayload: payload,
          promptpayAccountId: activeAccount.id,
          promptParseData,
          requestedByAdminId: adminRow.id,
          updatedAt: now,
        },
      });

    nextStatus = "awaiting_payment";
  } else if (action === "handed_off") {
    // Simplified hand-off: delivery fee was already set at accept time
    // Only need tracking URL to hand off to courier
    if (order.status !== "order_in_kitchen") {
      return NextResponse.json(
        { error: "Order is not in kitchen" },
        { status: 400 }
      );
    }

    const courierTrackingUrl =
      typeof body?.courierTrackingUrl === "string"
        ? body.courierTrackingUrl.trim()
        : "";

    if (!courierTrackingUrl) {
      return NextResponse.json(
        { error: "Delivery tracking link is required" },
        { status: 400 }
      );
    }

    const courierVendor =
      typeof body?.courierVendor === "string"
        ? body.courierVendor.trim()
        : null;

    nextStatus = "order_out_for_delivery";

    // Update order with tracking info and status
    await db
      .update(orders)
      .set({
        status: nextStatus,
        courierVendor,
        courierTrackingUrl,
        outForDeliveryAt: now,
        updatedAt: now,
      })
      .where(eq(orders.id, order.id));

    const [insertedEvent] = await db
      .insert(orderEvents)
      .values({
        orderId: order.id,
        actorType: "admin",
        actorId: userId,
        eventType: "status_updated",
        fromStatus: order.status,
        toStatus: nextStatus,
        metadata: {
          courierVendor,
          courierTrackingUrl,
        },
      })
      .returning({ id: orderEvents.id });

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

    return NextResponse.json({ status: nextStatus });
  } else if (action === "delivered") {
    if (
      order.status !== "order_out_for_delivery" &&
      order.status !== "order_in_kitchen"
    ) {
      return NextResponse.json(
        { error: "Order cannot be marked delivered from current status" },
        { status: 400 }
      );
    }

    nextStatus = "delivered";
  } else {
    nextStatus = "cancelled";
  }

  const updatePayload: Partial<typeof orders.$inferInsert> = {
    status: nextStatus,
    updatedAt: now,
  };

  // Set timestamps based on action
  if (action === "delivered") {
    updatePayload.deliveredAt = now;
    updatePayload.isClosed = true;
    updatePayload.closedAt = now;
  } else if (action === "cancel") {
    updatePayload.cancelledAt = now;
    updatePayload.cancelReason = reason;
    updatePayload.isClosed = true;
    updatePayload.closedAt = now;
  }

  await db
    .update(orders)
    .set(updatePayload)
    .where(eq(orders.id, order.id));

  const isTerminalState = action === "cancel" || action === "delivered";
  const criticalEventType =
    action === "cancel" ? "order_cancelled" : "order_delivered";

  const [insertedEvent] = await db
    .insert(orderEvents)
    .values({
      orderId: order.id,
      actorType: "admin",
      actorId: userId,
      eventType: isTerminalState ? criticalEventType : "status_updated",
      fromStatus: order.status,
      toStatus: nextStatus,
      metadata: reason ? { reason } : null,
    })
    .returning({ id: orderEvents.id });

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
  if (isTerminalState) {
    await broadcastOrderClosed({
      eventId: insertedEvent?.id ?? "",
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
