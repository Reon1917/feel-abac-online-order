import type { OrderStatus } from "./types";

export const ACTIVE_ORDER_BLOCK_CODE = "active_order_blocked" as const;

export const UNPAID_ORDER_STATUSES: OrderStatus[] = [
  "order_processing",
  "awaiting_payment",
  "payment_review",
];

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

export type ActiveOrderBlockError = Error & {
  code: typeof ACTIVE_ORDER_BLOCK_CODE;
  activeOrder: ActiveOrderBlockInfo;
};

export function createActiveOrderBlockError(
  activeOrder: ActiveOrderBlockInfo,
  message = "You can place a new order after payment for your current order is verified."
): ActiveOrderBlockError {
  const error = new Error(message) as ActiveOrderBlockError;
  error.code = ACTIVE_ORDER_BLOCK_CODE;
  error.activeOrder = activeOrder;
  return error;
}

export function isActiveOrderBlockError(
  error: unknown
): error is ActiveOrderBlockError {
  if (!(error instanceof Error)) {
    return false;
  }

  const candidate = error as Partial<ActiveOrderBlockError>;
  return (
    candidate.code === ACTIVE_ORDER_BLOCK_CODE &&
    typeof candidate.activeOrder?.displayId === "string" &&
    candidate.activeOrder.displayId.trim().length > 0
  );
}

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
