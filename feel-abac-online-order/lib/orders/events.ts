import type { OrderStatus, OrderPaymentType } from "./types";

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

// Payment events
export const PAYMENT_RECEIPT_UPLOADED_EVENT = "payment.receipt_uploaded";
export const PAYMENT_VERIFIED_EVENT = "payment.verified";
export const PAYMENT_REJECTED_EVENT = "payment.rejected";

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

// Payment event payloads
export type PaymentReceiptUploadedPayload = BaseEventPayload & {
  paymentType: OrderPaymentType;
  receiptUrl: string;
};

export type PaymentVerifiedPayload = BaseEventPayload & {
  paymentType: OrderPaymentType;
  verifiedByAdminId: string;
  newStatus: OrderStatus;
};

export type PaymentRejectedPayload = BaseEventPayload & {
  paymentType: OrderPaymentType;
  reason?: string | null;
  rejectionCount: number;
};
