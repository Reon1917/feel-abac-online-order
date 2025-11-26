import type { OrderStatus } from "./types";

// Channel names
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

// Event names
export const ORDER_STATUS_CHANGED_EVENT = "order.status.changed";
export const ORDER_SUBMITTED_EVENT = "order.submitted";
export const ORDER_CLOSED_EVENT = "order.closed";

/**
 * Base payload fields included in all events for deduplication.
 */
type BaseEventPayload = {
  eventId: string;  // order_events.id for client-side dedup
  orderId: string;
  displayId: string;
  at: string;
};

export type OrderStatusChangedPayload = BaseEventPayload & {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorType: "admin" | "user" | "system";
  reason?: string | null;
};

export type OrderSubmittedPayload = BaseEventPayload & {
  displayDay: string;  // YYYY-MM-DD for direct use without API fetch
  customerName: string;
  customerPhone: string;
  deliveryLabel: string;
  totalAmount: number;
  status: OrderStatus;
};

export type OrderClosedPayload = BaseEventPayload & {
  finalStatus: OrderStatus;  // "delivered" | "cancelled"
  actorType: "admin" | "user" | "system";
  reason?: string | null;
};
