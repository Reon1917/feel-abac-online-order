export type OrderStatus =
  | "order_processing"
  | "awaiting_food_payment"
  | "food_payment_review"
  | "order_in_kitchen"
  | "awaiting_delivery_fee_payment"
  | "delivery_payment_review"
  | "order_out_for_delivery"
  | "delivered"
  | "cancelled";

export type OrderPaymentType = "food" | "delivery";

export type OrderPaymentStatus =
  | "pending"
  | "receipt_uploaded"
  | "verified"
  | "rejected";

export type OrderPaymentRecord = {
  id: string;
  orderId: string;
  promptpayAccountId: string | null;
  type: OrderPaymentType;
  amount: number;
  status: OrderPaymentStatus;
  qrPayload: string | null;
  qrExpiresAt: string | null;
  receiptUrl: string | null;
  receiptUploadedAt: string | null;
  verifiedAt: string | null;
  verifiedByAdminId: string | null;
  rejectedReason: string | null;
  rejectionCount: number;
  requestedByAdminId: string | null;
  paymentIntentId: string | null;
  promptParseData: string | null;
  createdAt: string;
  updatedAt: string;
  payeeName?: string | null;
  payeePhoneNumber?: string | null;
};

export type OrderItemChoice = {
  id: string;
  orderItemId: string;
  groupName: string;
  groupNameMm: string | null;
  optionName: string;
  optionNameMm: string | null;
  extraPrice: number;
  selectionRole: "base" | "addon" | null;
  menuCode: string | null;
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
  deliveryMode: "preset" | "custom" | null;
  deliveryLocationId?: string | null;
  deliveryBuildingId?: string | null;
  customCondoName?: string | null;
  customBuildingName?: string | null;
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
  payments: OrderPaymentRecord[];
};

export type OrderEventMetadata = Record<string, unknown> | null;

export type OrderAdminSummary = {
  id: string;
  displayId: string;
  displayDay: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  deliveryLabel: string;
  createdAt: string;
};
