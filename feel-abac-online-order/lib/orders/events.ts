import type { OrderStatus } from "./types";

export const ADMIN_ORDERS_CHANNEL = "private-admin-orders";

export function buildOrderChannelName(displayId: string) {
  return `private-order-${displayId}`;
}

export function parseOrderChannelName(channelName: string) {
  const prefix = "private-order-";
  if (channelName.startsWith(prefix)) {
    return channelName.slice(prefix.length);
  }
  return null;
}

export const ORDER_STATUS_CHANGED_EVENT = "order.status.changed";

export type OrderStatusChangedPayload = {
  orderId: string;
  displayId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorType: "admin" | "user" | "system";
  reason?: string | null;
  at: string;
};
