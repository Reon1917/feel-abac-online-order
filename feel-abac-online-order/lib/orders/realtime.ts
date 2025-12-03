import "server-only";

import { getPusherServer } from "@/lib/pusher/server";
import {
  ADMIN_ORDERS_CHANNEL,
  ORDER_STATUS_CHANGED_EVENT,
  ORDER_SUBMITTED_EVENT,
  ORDER_CLOSED_EVENT,
  PAYMENT_RECEIPT_UPLOADED_EVENT,
  PAYMENT_VERIFIED_EVENT,
  PAYMENT_REJECTED_EVENT,
  buildOrderChannelName,
  type OrderStatusChangedPayload,
  type OrderSubmittedPayload,
  type OrderClosedPayload,
  type PaymentReceiptUploadedPayload,
  type PaymentVerifiedPayload,
  type PaymentRejectedPayload,
} from "./events";

/**
 * Broadcast to multiple channels in a single HTTP call using triggerBatch.
 * This reduces Pusher API calls by 50% compared to individual triggers.
 */
async function broadcastToChannels(
  channels: string[],
  eventName: string,
  payload: object
) {
  const pusher = getPusherServer();
  
  const batch = channels.map((channel) => ({
    channel,
    name: eventName,
    data: payload,
  }));

  try {
    await pusher.triggerBatch(batch);
  } catch (error) {
    // Log but don't throw - realtime is best-effort
    if (process.env.NODE_ENV !== "production") {
      console.error("[realtime] triggerBatch failed:", error);
    }
  }
}

export async function broadcastOrderStatusChanged(payload: OrderStatusChangedPayload) {
  await broadcastToChannels(
    [ADMIN_ORDERS_CHANNEL, buildOrderChannelName(payload.displayId)],
    ORDER_STATUS_CHANGED_EVENT,
    payload
  );
}

export async function broadcastOrderSubmitted(payload: OrderSubmittedPayload) {
  await broadcastToChannels(
    [ADMIN_ORDERS_CHANNEL, buildOrderChannelName(payload.displayId)],
    ORDER_SUBMITTED_EVENT,
    payload
  );
}

export async function broadcastOrderClosed(payload: OrderClosedPayload) {
  await broadcastToChannels(
    [ADMIN_ORDERS_CHANNEL, buildOrderChannelName(payload.displayId)],
    ORDER_CLOSED_EVENT,
    payload
  );
}

// Payment broadcasts
export async function broadcastPaymentReceiptUploaded(payload: PaymentReceiptUploadedPayload) {
  // Admin needs to know, customer channel for confirmation
  await broadcastToChannels(
    [ADMIN_ORDERS_CHANNEL, buildOrderChannelName(payload.displayId)],
    PAYMENT_RECEIPT_UPLOADED_EVENT,
    payload
  );
}

export async function broadcastPaymentVerified(payload: PaymentVerifiedPayload) {
  await broadcastToChannels(
    [ADMIN_ORDERS_CHANNEL, buildOrderChannelName(payload.displayId)],
    PAYMENT_VERIFIED_EVENT,
    payload
  );
}

export async function broadcastPaymentRejected(payload: PaymentRejectedPayload) {
  // Only customer channel needs rejection notification
  await broadcastToChannels(
    [buildOrderChannelName(payload.displayId)],
    PAYMENT_REJECTED_EVENT,
    payload
  );
}
