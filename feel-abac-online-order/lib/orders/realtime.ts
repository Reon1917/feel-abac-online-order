import "server-only";

import { getPusherServer } from "@/lib/pusher/server";
import { ADMIN_ORDERS_CHANNEL, buildOrderChannelName, ORDER_STATUS_CHANGED_EVENT, type OrderStatusChangedPayload } from "./events";

export async function broadcastOrderStatusChanged(payload: OrderStatusChangedPayload) {
  const pusher = getPusherServer();

  await Promise.allSettled([
    pusher.trigger(ADMIN_ORDERS_CHANNEL, ORDER_STATUS_CHANGED_EVENT, payload),
    pusher.trigger(buildOrderChannelName(payload.displayId), ORDER_STATUS_CHANGED_EVENT, payload),
  ]);
}
