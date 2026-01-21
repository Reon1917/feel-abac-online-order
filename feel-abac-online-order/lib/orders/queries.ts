import "server-only";

import { and, desc, eq, gte, ilike, inArray, lt, lte, or, sql, isNull } from "drizzle-orm";

import { db } from "@/src/db/client";
import {
  orderEvents,
  orderItemChoices,
  orderItems,
  orders,
  deliveryLocations,
  deliveryBuildings,
  orderPayments,
  promptpayAccounts,
} from "@/src/db/schema";
import type {
  OrderItemChoice,
  OrderItemRecord,
  OrderRecord,
  OrderAdminSummary,
  OrderStatus,
  RefundStatus,
  RefundType,
  OrderPaymentRecord,
  OrderPaymentStatus,
  OrderPaymentType,
} from "./types";
import { pgDateToString } from "@/lib/timezone";
import { numericToNumber } from "@/lib/db/numeric";

function dateToIso(value: Date | string | null | undefined) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.toISOString();
}

function mapOrderItemChoice(choice: typeof orderItemChoices.$inferSelect): OrderItemChoice {
  return {
    id: choice.id,
    orderItemId: choice.orderItemId,
    groupName: choice.groupName,
    groupNameMm: choice.groupNameMm,
    optionName: choice.optionName,
    optionNameMm: choice.optionNameMm,
    extraPrice: numericToNumber(choice.extraPrice),
    selectionRole: (choice.selectionRole as OrderItemChoice["selectionRole"]) ?? null,
    menuCode: choice.menuCode,
  };
}

function mapOrderItem(
  item: typeof orderItems.$inferSelect,
  choices: OrderItemChoice[]
): OrderItemRecord {
  return {
    id: item.id,
    orderId: item.orderId,
    menuItemId: item.menuItemId,
    menuItemName: item.menuItemName,
    menuItemNameMm: item.menuItemNameMm,
    menuCode: item.menuCode,
    basePrice: numericToNumber(item.basePrice),
    addonsTotal: numericToNumber(item.addonsTotal),
    quantity: item.quantity,
    note: item.note,
    totalPrice: numericToNumber(item.totalPrice),
    displayOrder: item.displayOrder,
    createdAt: dateToIso(item.createdAt) ?? "",
    choices,
  };
}

function mapOrderPayment(
  payment: typeof orderPayments.$inferSelect,
  payeeName: string | null,
  payeePhoneNumber: string | null
): OrderPaymentRecord {
  return {
    id: payment.id,
    orderId: payment.orderId,
    promptpayAccountId: payment.promptpayAccountId,
    type: payment.type as OrderPaymentType,
    amount: numericToNumber(payment.amount),
    status: payment.status as OrderPaymentStatus,
    qrPayload: payment.qrPayload,
    qrExpiresAt: dateToIso(payment.qrExpiresAt),
    receiptUrl: payment.receiptUrl,
    receiptUploadedAt: dateToIso(payment.receiptUploadedAt),
    verifiedAt: dateToIso(payment.verifiedAt),
    verifiedByAdminId: payment.verifiedByAdminId,
    rejectedReason: payment.rejectedReason,
    rejectionCount: payment.rejectionCount ?? 0,
    requestedByAdminId: payment.requestedByAdminId,
    paymentIntentId: payment.paymentIntentId,
    promptParseData: payment.promptParseData,
    createdAt: dateToIso(payment.createdAt) ?? "",
    updatedAt: dateToIso(payment.updatedAt) ?? "",
    payeeName,
    payeePhoneNumber,
  };
}

function mapOrder(
  row: typeof orders.$inferSelect,
  items: OrderItemRecord[],
  payments: OrderPaymentRecord[]
): OrderRecord {
  return {
    id: row.id,
    displayId: row.displayId,
    displayCounter: row.displayCounter,
    displayDay: pgDateToString(row.displayDay),
    status: row.status as OrderStatus,
    orderNote: row.orderNote,
    adminNote: row.adminNote,
    deliveryNotes: row.deliveryNotes,
    subtotal: numericToNumber(row.subtotal),
    deliveryFee: row.deliveryFee ? numericToNumber(row.deliveryFee) : null,
    discountTotal: numericToNumber(row.discountTotal),
    totalAmount: numericToNumber(row.totalAmount),
    deliveryMode: row.deliveryMode as "preset" | "custom" | null,
    deliveryLocationId: row.deliveryLocationId,
    deliveryBuildingId: row.deliveryBuildingId,
    customCondoName: row.customCondoName ?? null,
    customBuildingName: row.customBuildingName ?? null,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    createdAt: dateToIso(row.createdAt) ?? "",
    updatedAt: dateToIso(row.updatedAt) ?? "",
    cancelledAt: dateToIso(row.cancelledAt),
    cancelReason: row.cancelReason,
    refundStatus: (row.refundStatus as RefundStatus) ?? null,
    refundType: (row.refundType as RefundType) ?? null,
    refundAmount: row.refundAmount ? numericToNumber(row.refundAmount) : null,
    refundReason: row.refundReason ?? null,
    refundProcessedAt: dateToIso(row.refundProcessedAt),
    isClosed: row.isClosed,
    courierTrackingUrl: row.courierTrackingUrl,
    courierVendor: row.courierVendor,
    courierPaymentStatus: row.courierPaymentStatus,
    items,
    payments,
  };
}

async function loadOrderItems(orderId: string): Promise<OrderItemRecord[]> {
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(orderItems.displayOrder, orderItems.createdAt);

  if (items.length === 0) {
    return [];
  }

  const itemIds = items.map((item) => item.id);
  const choices = await db
    .select()
    .from(orderItemChoices)
    .where(inArray(orderItemChoices.orderItemId, itemIds));

  const choicesByItem = new Map<string, OrderItemChoice[]>();
  for (const choice of choices) {
    const mapped = mapOrderItemChoice(choice);
    const current = choicesByItem.get(choice.orderItemId) ?? [];
    current.push(mapped);
    choicesByItem.set(choice.orderItemId, current);
  }

  return items.map((item) =>
    mapOrderItem(item, choicesByItem.get(item.id) ?? [])
  );
}

async function loadOrderPayments(orderId: string): Promise<OrderPaymentRecord[]> {
  const rows = await db
    .select({
      payment: orderPayments,
      accountName: promptpayAccounts.name,
      accountPhone: promptpayAccounts.phoneNumber,
    })
    .from(orderPayments)
    .leftJoin(
      promptpayAccounts,
      eq(orderPayments.promptpayAccountId, promptpayAccounts.id)
    )
    .where(eq(orderPayments.orderId, orderId))
    .orderBy(orderPayments.createdAt);

  return rows.map((row) =>
    mapOrderPayment(row.payment, row.accountName ?? null, row.accountPhone ?? null)
  );
}

export async function getOrderAccessInfo(displayId: string) {
  const [row] = await db
    .select({
      id: orders.id,
      userId: orders.userId,
      status: orders.status,
      isClosed: orders.isClosed,
    })
    .from(orders)
    .where(eq(orders.displayId, displayId))
    .orderBy(desc(orders.createdAt))
    .limit(1);

  return row ?? null;
}

export async function getOrderByDisplayId(
  displayId: string,
  viewer: { userId?: string | null; isAdmin?: boolean }
): Promise<OrderRecord | null> {
  const [row] = await db
    .select()
    .from(orders)
    .where(eq(orders.displayId, displayId))
    .orderBy(desc(orders.createdAt))
    .limit(1);

  if (!row) {
    return null;
  }

  const isAdmin = viewer.isAdmin ?? false;
  const userId = viewer.userId;

  if (!isAdmin && row.userId && row.userId !== userId) {
    return null;
  }

  const items = await loadOrderItems(row.id);
  const payments = await loadOrderPayments(row.id);
  return mapOrder(row, items, payments);
}

export async function appendOrderEvent(input: {
  orderId: string;
  actorType: "admin" | "user" | "system";
  actorId?: string | null;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  metadata?: object | null;
}) {
  const payload: typeof orderEvents.$inferInsert = {
    orderId: input.orderId,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    eventType: input.eventType,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    metadata: input.metadata ?? null,
  };

  await db.insert(orderEvents).values(payload);
}

// Optimized: Only select columns needed for admin summary
const adminSummarySelect = {
  id: orders.id,
  displayId: orders.displayId,
  displayDay: orders.displayDay,
  status: orders.status,
  isClosed: orders.isClosed,
  refundStatus: orders.refundStatus,
  refundType: orders.refundType,
  refundAmount: orders.refundAmount,
  customerName: orders.customerName,
  customerPhone: orders.customerPhone,
  subtotal: orders.subtotal,
  deliveryFee: orders.deliveryFee,
  totalAmount: orders.totalAmount,
  createdAt: orders.createdAt,
  deliveryMode: orders.deliveryMode,
  customCondoName: orders.customCondoName,
  customBuildingName: orders.customBuildingName,
  locationCondoName: deliveryLocations.condoName,
  buildingLabel: deliveryBuildings.label,
  // Subquery to check if order has verified payment
  hasVerifiedPayment: sql<string>`(
    SELECT CASE WHEN EXISTS (
      SELECT 1 FROM order_payments op 
      WHERE op.order_id = orders.id 
      AND op.status = 'verified'
    ) THEN 'true' ELSE 'false' END
  )`.as("has_verified_payment"),
} as const;

type AdminSummaryRow = {
  id: string;
  displayId: string;
  displayDay: Date | null;
  status: string;
  isClosed: boolean | null;
  refundStatus: string | null;
  refundType: string | null;
  refundAmount: string | null;
  customerName: string;
  customerPhone: string;
  subtotal: string | null;
  deliveryFee: string | null;
  totalAmount: string | null;
  createdAt: Date | null;
  deliveryMode: string | null;
  customCondoName: string | null;
  customBuildingName: string | null;
  locationCondoName: string | null;
  buildingLabel: string | null;
  hasVerifiedPayment: string;
};

function mapOrderAdminSummary(row: AdminSummaryRow): OrderAdminSummary {
  const deliveryLabel =
    row.deliveryMode === "custom"
      ? `${row.customCondoName ?? "Custom"}${
          row.customBuildingName ? `, ${row.customBuildingName}` : ""
        }`
      : `${row.locationCondoName ?? "Unknown"}${
          row.buildingLabel ? `, ${row.buildingLabel}` : ""
        }`;

  return {
    id: row.id,
    displayId: row.displayId,
    displayDay: pgDateToString(row.displayDay),
    status: row.status as OrderStatus,
    isClosed: Boolean(row.isClosed),
    refundStatus: (row.refundStatus as RefundStatus) ?? null,
    refundType: (row.refundType as RefundType) ?? null,
    refundAmount: row.refundAmount ? numericToNumber(row.refundAmount) : null,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    subtotal: numericToNumber(row.subtotal),
    deliveryFee: row.deliveryFee ? numericToNumber(row.deliveryFee) : null,
    totalAmount: numericToNumber(row.totalAmount),
    deliveryLabel,
    createdAt: dateToIso(row.createdAt) ?? "",
    hasVerifiedPayment: row.hasVerifiedPayment === "true",
  };
}

export async function getRecentOrdersForAdmin(limit = 20): Promise<OrderAdminSummary[]> {
  const rows = await db
    .select(adminSummarySelect)
    .from(orders)
    .leftJoin(
      deliveryLocations,
      eq(orders.deliveryLocationId, deliveryLocations.id)
    )
    .leftJoin(
      deliveryBuildings,
      eq(orders.deliveryBuildingId, deliveryBuildings.id)
    )
    .orderBy(desc(orders.createdAt))
    .limit(limit);

  return rows.map((row) => mapOrderAdminSummary(row));
}

/**
 * Get today's orders for admin (Bangkok timezone).
 * All orders from today show here regardless of status (including cancelled).
 */
export async function getTodayOrdersForAdmin(): Promise<OrderAdminSummary[]> {
  const rows = await db
    .select(adminSummarySelect)
    .from(orders)
    .leftJoin(
      deliveryLocations,
      eq(orders.deliveryLocationId, deliveryLocations.id)
    )
    .leftJoin(
      deliveryBuildings,
      eq(orders.deliveryBuildingId, deliveryBuildings.id)
    )
    .where(
      eq(orders.displayDay, sql`(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date`)
    )
    .orderBy(desc(orders.createdAt));

  return rows.map((row) => mapOrderAdminSummary(row));
}

/**
 * Get past orders (before today) for admin.
 * Groups by displayDay in the client. Excludes today's orders.
 */
export async function getArchivedOrdersForAdmin(
  limit = 100
): Promise<OrderAdminSummary[]> {
  const rows = await db
    .select(adminSummarySelect)
    .from(orders)
    .leftJoin(
      deliveryLocations,
      eq(orders.deliveryLocationId, deliveryLocations.id)
    )
    .leftJoin(
      deliveryBuildings,
      eq(orders.deliveryBuildingId, deliveryBuildings.id)
    )
    .where(
      lt(orders.displayDay, sql`(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date`)
    )
    .orderBy(desc(orders.displayDay), desc(orders.createdAt))
    .limit(limit);

  return rows.map((row) => mapOrderAdminSummary(row));
}

/**
 * Get distinct archived order days (before today) for admin filters.
 */
export async function getArchivedOrderDays(limit = 7): Promise<string[]> {
  const today = sql`(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date`;
  const sevenDaysAgo = sql`(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date - INTERVAL '7 days'`;
  const rows = await db
    .select({
      displayDay: orders.displayDay,
    })
    .from(orders)
    .where(
      and(
        lt(orders.displayDay, today),
        gte(orders.displayDay, sevenDaysAgo)
      )
    )
    .groupBy(orders.displayDay)
    .orderBy(desc(orders.displayDay))
    .limit(limit);

  return rows
    .map((row) => pgDateToString(row.displayDay))
    .filter((value) => value.length > 0);
}

/**
 * Get archived orders with optional filters (limited to the last 7 days).
 */
export async function getArchivedOrdersForAdminFiltered(filters: {
  displayDay?: string | null;
  status?: OrderStatus | null;
  refundStatus?: "requested" | "paid" | "none" | null;
  query?: string | null;
  minTotal?: number | null;
  maxTotal?: number | null;
}): Promise<OrderAdminSummary[]> {
  const today = sql`(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date`;
  const sevenDaysAgo = sql`(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date - INTERVAL '7 days'`;
  const conditions = [];

  if (filters.displayDay) {
    conditions.push(eq(orders.displayDay, sql`${filters.displayDay}::date`));
  } else {
    conditions.push(lt(orders.displayDay, today));
    conditions.push(gte(orders.displayDay, sevenDaysAgo));
  }

  if (filters.status) {
    conditions.push(eq(orders.status, filters.status));
  }

  if (filters.refundStatus === "requested" || filters.refundStatus === "paid") {
    conditions.push(eq(orders.refundStatus, filters.refundStatus));
  } else if (filters.refundStatus === "none") {
    conditions.push(isNull(orders.refundStatus));
  }

  if (filters.query) {
    const keyword = `%${filters.query}%`;
    conditions.push(
      or(
        ilike(orders.displayId, keyword),
        ilike(orders.customerName, keyword),
        ilike(orders.customerPhone, keyword)
      )
    );
  }

  if (typeof filters.minTotal === "number") {
    conditions.push(gte(orders.totalAmount, String(filters.minTotal)));
  }

  if (typeof filters.maxTotal === "number") {
    conditions.push(lte(orders.totalAmount, String(filters.maxTotal)));
  }

  const rows = await db
    .select(adminSummarySelect)
    .from(orders)
    .leftJoin(
      deliveryLocations,
      eq(orders.deliveryLocationId, deliveryLocations.id)
    )
    .leftJoin(
      deliveryBuildings,
      eq(orders.deliveryBuildingId, deliveryBuildings.id)
    )
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt));

  return rows.map((row) => mapOrderAdminSummary(row));
}

/**
 * Get full order details for admin modal view.
 */
export async function getOrderDetailForAdmin(
  displayId: string
): Promise<OrderRecord | null> {
  const [row] = await db
    .select()
    .from(orders)
    .where(eq(orders.displayId, displayId))
    .orderBy(desc(orders.createdAt))
    .limit(1);

  if (!row) {
    return null;
  }

  const items = await loadOrderItems(row.id);
  const payments = await loadOrderPayments(row.id);
  return mapOrder(row, items, payments);
}

/**
 * User order summary - minimal data for order history list.
 */
export type UserOrderSummary = {
  id: string;
  displayId: string;
  status: OrderStatus;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
};

/**
 * Get user's order history.
 */
export async function getOrdersForUser(
  userId: string,
  limit = 20
): Promise<UserOrderSummary[]> {
  const rows = await db
    .select({
      id: orders.id,
      displayId: orders.displayId,
      status: orders.status,
      totalAmount: orders.totalAmount,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);

  // Get item counts for each order
  const orderIds = rows.map((r) => r.id);
  if (orderIds.length === 0) {
    return [];
  }

  const itemCounts = await db
    .select({
      orderId: orderItems.orderId,
      count: sql<number>`sum(${orderItems.quantity})`.as("count"),
    })
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds))
    .groupBy(orderItems.orderId);

  const countMap = new Map(itemCounts.map((ic) => [ic.orderId, Number(ic.count) || 0]));

  return rows.map((row) => ({
    id: row.id,
    displayId: row.displayId,
    status: row.status as OrderStatus,
    totalAmount: numericToNumber(row.totalAmount),
    itemCount: countMap.get(row.id) ?? 0,
    createdAt: dateToIso(row.createdAt) ?? "",
  }));
}

/**
 * Build order details for email notifications.
 * Fetches the full order with items and formats it for email templates.
 * Uses admin privileges to access order regardless of user ownership.
 */
export async function getOrderEmailDetails(displayId: string) {
  const order = await getOrderByDisplayId(displayId, { isAdmin: true });
  if (!order) return null;

  // Build address string from delivery info
  let deliveryAddress = "";
  if (order.deliveryMode === "preset" && order.deliveryLocationId) {
    // Fetch location and building details separately to avoid Drizzle ORM join issues
    const locations = await db
      .select({ condoName: deliveryLocations.condoName })
      .from(deliveryLocations)
      .where(eq(deliveryLocations.id, order.deliveryLocationId))
      .limit(1);

    const locationCondoName = locations[0]?.condoName ?? "";
    let buildingLabel = "";

    if (order.deliveryBuildingId) {
      const buildings = await db
        .select({ label: deliveryBuildings.label })
        .from(deliveryBuildings)
        .where(eq(deliveryBuildings.id, order.deliveryBuildingId))
        .limit(1);
      buildingLabel = buildings[0]?.label ?? "";
    }

    deliveryAddress = [locationCondoName, buildingLabel]
      .filter(Boolean)
      .join(" – ");
  } else if (order.deliveryMode === "custom") {
    deliveryAddress = [order.customCondoName, order.customBuildingName]
      .filter(Boolean)
      .join(" – ");
  }

  if (!deliveryAddress) {
    deliveryAddress = "See order for details";
  }

  // Build items array for email
  const items = (order.items ?? []).map((item) => {
    const choices = (item.choices ?? [])
      .filter((c) => c.selectionRole !== "base")
      .map((c) => c.optionName);
    return {
      name: item.menuItemName,
      quantity: item.quantity,
      price: item.totalPrice,
      choices: choices.length > 0 ? choices : undefined,
      note: item.note,
    };
  });

  return {
    customerName: order.customerName ?? "Customer",
    customerPhone: order.customerPhone ?? "",
    deliveryAddress,
    deliveryNotes: order.deliveryNotes,
    orderNote: order.orderNote,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    items,
  };
}
