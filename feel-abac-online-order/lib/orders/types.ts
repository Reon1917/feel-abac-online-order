import type { Json } from "drizzle-orm";

export type OrderStatus =
  | "order_processing"
  | "awaiting_food_payment"
  | "food_payment_review"
  | "order_in_kitchen"
  | "order_out_for_delivery"
  | "awaiting_delivery_fee_payment"
  | "delivered"
  | "cancelled";

export type OrderItemChoice = {
  id: string;
  orderItemId: string;
  groupName: string;
  groupNameMm: string | null;
  optionName: string;
  optionNameMm: string | null;
  extraPrice: number;
};

export type OrderItemRecord = {
  id: string;
  orderId: string;
  menuItemId: string | null;
  menuItemName: string;
  menuItemNameMm: string | null;
  menuCode: string | null;
  basePrice: number;
  addonsTotal: number;
  quantity: number;
  note: string | null;
  totalPrice: number;
  displayOrder: number;
  createdAt: string;
  choices: OrderItemChoice[];
};

export type OrderRecord = {
  id: string;
  displayId: string;
  displayCounter: number;
  displayDay: string;
  status: OrderStatus;
  orderNote: string | null;
  adminNote: string | null;
  deliveryNotes: string | null;
  subtotal: number;
  deliveryFee: number | null;
  discountTotal: number;
  totalAmount: number;
  customerName: string;
  customerPhone: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  isClosed: boolean;
  courierTrackingUrl: string | null;
  courierVendor: string | null;
  courierPaymentStatus: string | null;
  items: OrderItemRecord[];
};

export type OrderEventMetadata = Json;
