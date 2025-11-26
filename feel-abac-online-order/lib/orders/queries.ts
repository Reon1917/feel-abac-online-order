import "server-only";

import { desc, eq, inArray, sql, lt } from "drizzle-orm";

import { db } from "@/src/db/client";
import {
  orderEvents,
  orderItemChoices,
  orderItems,
  orders,
  deliveryLocations,
  deliveryBuildings,
} from "@/src/db/schema";
import type {
  OrderItemChoice,
  OrderItemRecord,
  OrderRecord,
  OrderAdminSummary,
  OrderStatus,
} from "./types";

function numericToNumber(value: string | null): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

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

function mapOrder(
  row: typeof orders.$inferSelect,
  items: OrderItemRecord[]
): OrderRecord {
  return {
    id: row.id,
    displayId: row.displayId,
    displayCounter: row.displayCounter,
    displayDay: row.displayDay
      ? typeof row.displayDay === "string"
        ? row.displayDay
        : row.displayDay.toISOString().slice(0, 10)
      : "",
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
    isClosed: row.isClosed,
    courierTrackingUrl: row.courierTrackingUrl,
    courierVendor: row.courierVendor,
    courierPaymentStatus: row.courierPaymentStatus,
    items,
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
  return mapOrder(row, items);
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
  customerName: orders.customerName,
  customerPhone: orders.customerPhone,
  totalAmount: orders.totalAmount,
  createdAt: orders.createdAt,
  deliveryMode: orders.deliveryMode,
  customCondoName: orders.customCondoName,
  customBuildingName: orders.customBuildingName,
  locationCondoName: deliveryLocations.condoName,
  buildingLabel: deliveryBuildings.label,
} as const;

type AdminSummaryRow = {
  id: string;
  displayId: string;
  displayDay: Date | null;
  status: string;
  customerName: string;
  customerPhone: string;
  totalAmount: string | null;
  createdAt: Date | null;
  deliveryMode: string | null;
  customCondoName: string | null;
  customBuildingName: string | null;
  locationCondoName: string | null;
  buildingLabel: string | null;
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
    displayDay: row.displayDay
      ? row.displayDay.toISOString().slice(0, 10)
      : "",
    status: row.status as OrderStatus,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    totalAmount: numericToNumber(row.totalAmount),
    deliveryLabel,
    createdAt: dateToIso(row.createdAt) ?? "",
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
  return mapOrder(row, items);
}
