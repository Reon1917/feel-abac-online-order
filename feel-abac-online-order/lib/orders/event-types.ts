/**
 * Event type registry for order lifecycle events.
 * 
 * - critical: true = kept forever (for auditing)
 * - critical: false = deleted when order closes (transient)
 * - channels: ["admin"] = private-admin-orders only
 * - channels: ["order"] = private-order-{displayId} only
 * - channels: ["admin", "order"] = both channels
 */

export const EVENT_REGISTRY = {
  // MVP - Order Lifecycle
  "order.submitted": { 
    critical: true, 
    channels: ["admin", "order"] as const,
    dbEventType: "order_submitted",
  },
  "order.status.changed": { 
    critical: false, 
    channels: ["admin", "order"] as const,
    dbEventType: "status_updated",
  },
  "order.closed": { 
    critical: true, 
    channels: ["admin", "order"] as const,
    dbEventType: "order_closed",
  },
  
  // Terminal states (stored as critical events)
  "order.cancelled": {
    critical: true,
    channels: ["admin", "order"] as const,
    dbEventType: "order_cancelled",
  },
  "order.delivered": {
    critical: true,
    channels: ["admin", "order"] as const,
    dbEventType: "order_delivered",
  },
  
  // Future: Payments
  "payment.requested": { 
    critical: false, 
    channels: ["order"] as const,
    dbEventType: "payment_requested",
  },
  "payment.receipt_uploaded": { 
    critical: false, 
    channels: ["admin"] as const,
    dbEventType: "payment_receipt_uploaded",
  },
  "payment.verified": { 
    critical: false, 
    channels: ["admin", "order"] as const,
    dbEventType: "payment_verified",
  },
  "payment.rejected": { 
    critical: false, 
    channels: ["admin", "order"] as const,
    dbEventType: "payment_rejected",
  },
  
  // Future: Courier
  "courier.assigned": { 
    critical: false, 
    channels: ["order"] as const,
    dbEventType: "courier_assigned",
  },
  "courier.tracking.updated": { 
    critical: false, 
    channels: ["order"] as const,
    dbEventType: "courier_tracking_updated",
  },
} as const;

export type EventName = keyof typeof EVENT_REGISTRY;
export type DbEventType = typeof EVENT_REGISTRY[EventName]["dbEventType"];

/**
 * Event types that are kept permanently for auditing.
 * These are NOT deleted when an order closes.
 */
export const CRITICAL_DB_EVENT_TYPES: DbEventType[] = Object.values(EVENT_REGISTRY)
  .filter((config) => config.critical)
  .map((config) => config.dbEventType) as DbEventType[];

/**
 * Event types that are transient and can be deleted after order closes.
 */
export const TRANSIENT_DB_EVENT_TYPES: DbEventType[] = Object.values(EVENT_REGISTRY)
  .filter((config) => !config.critical)
  .map((config) => config.dbEventType) as DbEventType[];

/**
 * Get the event configuration for a given event name.
 */
export function getEventConfig(eventName: EventName) {
  return EVENT_REGISTRY[eventName];
}

/**
 * Check if a DB event type is critical (should be kept).
 */
export function isCriticalEvent(dbEventType: string): boolean {
  return CRITICAL_DB_EVENT_TYPES.includes(dbEventType as DbEventType);
}

/**
 * Check if a DB event type is transient (can be deleted).
 */
export function isTransientEvent(dbEventType: string): boolean {
  return TRANSIENT_DB_EVENT_TYPES.includes(dbEventType as DbEventType);
}

