export type OrderStatus =
  | "order_processing"     // RECEIVED - new order just submitted
  | "awaiting_payment"     // WAIT_FOR_PAYMENT - admin accepted, customer must pay
  | "payment_review"       // WAIT_FOR_PAYMENT - slip uploaded, pending verification
  | "order_in_kitchen"     // PAID - payment verified, preparing food
  | "order_out_for_delivery" // HAND_TO_DELIVERY - food handed to courier
  | "delivered"            // DELIVERED - courier completed delivery
  | "closed"               // CLOSED - order archived
  | "cancelled";           // Cancelled/rejected order

export type RefundStatus = "requested" | "paid";

export type OrderPaymentType = "combined";

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
  refundStatus: RefundStatus | null;
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
  refundStatus: RefundStatus | null;
  customerName: string;
  customerPhone: string;
  subtotal: number;
  deliveryFee: number | null;
  totalAmount: number;
  deliveryLabel: string;
  createdAt: string;
  /** True if order has at least one verified payment (determines if refund is needed on cancel) */
  hasVerifiedPayment: boolean;
};
