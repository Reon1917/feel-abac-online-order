import type { OrderAdminSummary } from "./types";

/**
 * Orders considered active in admin surfaces (still needs operational action).
 */
export function isLiveAdminOrder(order: OrderAdminSummary): boolean {
  if (order.isClosed) {
    return false;
  }

  return !["delivered", "cancelled", "closed"].includes(order.status);
}

/**
 * Orders counted as completed for dashboard daily summary.
 */
export function isCompletedAdminOrder(order: OrderAdminSummary): boolean {
  return order.status === "delivered" || order.status === "closed";
}

export function countLiveAdminOrders(orders: OrderAdminSummary[]): number {
  return orders.filter(isLiveAdminOrder).length;
}

export function countCompletedAdminOrders(orders: OrderAdminSummary[]): number {
  return orders.filter(isCompletedAdminOrder).length;
}
