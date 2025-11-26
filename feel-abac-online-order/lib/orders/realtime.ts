import "server-only";

import { getPusherServer } from "@/lib/pusher/server";
import {
  ADMIN_ORDERS_CHANNEL,
  ORDER_STATUS_CHANGED_EVENT,
  ORDER_SUBMITTED_EVENT,
  ORDER_CLOSED_EVENT,
  buildOrderChannelName,
  type OrderStatusChangedPayload,
  type OrderSubmittedPayload,
  type OrderClosedPayload,
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
    console.error("[realtime] triggerBatch failed:", error);
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
