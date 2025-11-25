import "server-only";

import { getPusherServer } from "@/lib/pusher/server";
import {
  ADMIN_ORDERS_CHANNEL,
  ORDER_STATUS_CHANGED_EVENT,
  ORDER_SUBMITTED_EVENT,
  buildOrderChannelName,
  type OrderStatusChangedPayload,
  type OrderSubmittedPayload,
} from "./events";

export async function broadcastOrderStatusChanged(payload: OrderStatusChangedPayload) {
  const pusher = getPusherServer();

  await Promise.allSettled([
    pusher.trigger(ADMIN_ORDERS_CHANNEL, ORDER_STATUS_CHANGED_EVENT, payload),
    pusher.trigger(buildOrderChannelName(payload.displayId), ORDER_STATUS_CHANGED_EVENT, payload),
  ]);
}

export async function broadcastOrderSubmitted(payload: OrderSubmittedPayload) {
  const pusher = getPusherServer();

  await Promise.allSettled([
    pusher.trigger(ADMIN_ORDERS_CHANNEL, ORDER_SUBMITTED_EVENT, payload),
    pusher.trigger(buildOrderChannelName(payload.displayId), ORDER_SUBMITTED_EVENT, payload),
  ]);
}
