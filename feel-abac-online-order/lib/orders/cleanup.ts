import "server-only";

import { and, eq, notInArray } from "drizzle-orm";

import { db } from "@/src/db/client";
import { orderEvents } from "@/src/db/schema";
import { CRITICAL_DB_EVENT_TYPES } from "./event-types";

/**
 * Delete transient events for an order, keeping only critical events.
 * 
 * Critical events (kept forever):
 * - order_submitted
 * - order_cancelled
 * - order_delivered
 * - order_closed
 * 
 * Transient events (deleted on close):
 * - status_updated
 * - payment_requested
 * - payment_verified
 * - etc.
 * 
 * @param orderId The order ID to clean up events for
 * @returns Number of deleted events
 */
export async function cleanupTransientEvents(orderId: string): Promise<number> {
  const result = await db
    .delete(orderEvents)
    .where(
      and(
        eq(orderEvents.orderId, orderId),
        notInArray(orderEvents.eventType, CRITICAL_DB_EVENT_TYPES)
      )
    )
    .returning({ id: orderEvents.id });

  return result.length;
}

/**
 * Get the count of events for an order (for debugging/monitoring).
 */
export async function getOrderEventCount(orderId: string): Promise<number> {
  const events = await db
    .select({ id: orderEvents.id })
    .from(orderEvents)
    .where(eq(orderEvents.orderId, orderId));

  return events.length;
}

