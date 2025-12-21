import type { OrderStatus, RefundStatus } from "./types";

export function statusLabel(
  status: OrderStatus,
  dictionary: Record<string, string>,
  options?: { refundStatus?: RefundStatus | null }
) {
  switch (status) {
    case "order_processing":
      return dictionary.statusProcessing ?? "Received";
    case "awaiting_payment":
      return dictionary.statusAwaitingPayment ?? "Awaiting Payment";
    case "payment_review":
      return dictionary.statusPaymentReview ?? "Verifying Payment";
    case "order_in_kitchen":
      return dictionary.statusKitchen ?? "Paid";
    case "order_out_for_delivery":
      return dictionary.statusOutForDelivery ?? "With Delivery";
    case "delivered":
      return dictionary.statusDelivered ?? "Delivered";
    case "closed":
      return dictionary.statusClosed ?? "Closed";
    case "cancelled":
      if (options?.refundStatus === "paid") {
        return dictionary.statusRefundPaid ?? "Refund paid";
      }
      if (options?.refundStatus === "requested") {
        return dictionary.statusRefundRequested ?? "Order cancelled after payment";
      }
      return dictionary.statusCancelled ?? "Cancelled";
    default:
      return status;
  }
}

export function statusBadgeClass(status: OrderStatus) {
  if (status === "cancelled")
    return "bg-red-50 text-red-700 ring-1 ring-red-200";
  if (status === "closed")
    return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  if (
    status === "order_in_kitchen" ||
    status === "order_out_for_delivery" ||
    status === "delivered"
  ) {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }
  return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
}
