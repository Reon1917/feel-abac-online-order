import type { OrderStatus } from "./types";

export function statusLabel(
  status: OrderStatus,
  dictionary: Record<string, string>
) {
  switch (status) {
    case "order_processing":
      return dictionary.statusProcessing ?? "Processing";
    case "awaiting_food_payment":
      return dictionary.statusAwaitingFoodPayment ?? "Awaiting Food Payment";
    case "food_payment_review":
      return dictionary.statusFoodPaymentReview ?? "Food Payment Review";
    case "order_in_kitchen":
      return dictionary.statusKitchen ?? "In Kitchen";
    case "order_out_for_delivery":
      return dictionary.statusOutForDelivery ?? "Out for Delivery";
    case "awaiting_delivery_fee_payment":
      return dictionary.statusAwaitingDeliveryFee ?? "Awaiting Delivery Fee";
    case "delivered":
      return dictionary.statusDelivered ?? "Delivered";
    case "cancelled":
      return dictionary.statusCancelled ?? "Cancelled";
    default:
      return status;
  }
}

export function statusBadgeClass(status: OrderStatus) {
  if (status === "cancelled")
    return "bg-red-50 text-red-700 ring-1 ring-red-200";
  if (
    status === "order_in_kitchen" ||
    status === "order_out_for_delivery" ||
    status === "delivered"
  ) {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }
  return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
}
