import type { OrderStatus } from "./types";

export const ACTIVE_ORDER_BLOCK_CODE = "active_order_blocked" as const;

export type ActiveOrderBlockInfo = {
  displayId: string;
  status: OrderStatus | null;
};

type ActiveOrderBlockPayload = {
  code?: string;
  activeOrder?: {
    displayId?: string | null;
    status?: string | null;
  } | null;
};

export function extractActiveOrderBlock(
  payload: unknown
): ActiveOrderBlockInfo | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const cast = payload as ActiveOrderBlockPayload;
  if (cast.code !== ACTIVE_ORDER_BLOCK_CODE) {
    return null;
  }

  const displayId =
    typeof cast.activeOrder?.displayId === "string"
      ? cast.activeOrder.displayId.trim()
      : "";

  if (!displayId) {
    return null;
  }

  const status =
    typeof cast.activeOrder?.status === "string"
      ? (cast.activeOrder.status as OrderStatus)
      : null;

  return { displayId, status };
}
