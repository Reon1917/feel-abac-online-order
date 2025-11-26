import "server-only";

import { eq, sql, desc, inArray } from "drizzle-orm";

import { db } from "@/src/db/client";
import {
  cartItemChoices,
  cartItems,
  carts,
  deliveryBuildings,
  deliveryLocations,
  orderEvents,
  orderItemChoices,
  orderItems,
  orders,
  users,
} from "@/src/db/schema";
import { getActiveCartForUser } from "@/lib/cart/queries";
import type { DeliverySelection } from "@/lib/delivery/types";
import { getUserProfile } from "@/lib/user-profile";
import type { OrderStatus } from "./types";
import { broadcastOrderSubmitted } from "./realtime";
import type { OrderSubmittedPayload } from "./events";

type CreateOrderInput = {
  userId: string;
  deliverySelection: DeliverySelection;
};

function toNumericString(value: number) {
  return value.toFixed(2);
}

function nowUtc() {
  return new Date();
}

function bangkokDateString(reference: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.format(reference);
  return parts;
}

async function formatDeliveryLabel(selection: DeliverySelection) {
  if (selection.mode === "preset") {
    const [location] = await db
      .select({
        condoName: deliveryLocations.condoName,
      })
      .from(deliveryLocations)
      .where(eq(deliveryLocations.id, selection.locationId))
      .limit(1);

    if (!location) {
      throw new Error("Delivery location not found");
    }

    const [building] =
      selection.buildingId != null
        ? await db
            .select({ label: deliveryBuildings.label })
            .from(deliveryBuildings)
            .where(eq(deliveryBuildings.id, selection.buildingId))
            .limit(1)
        : [];

    const buildingLabel = building?.label ? `, ${building.label}` : "";
    return `${location?.condoName ?? "Unknown"}${buildingLabel}`;
  }

  const building = selection.customBuildingName
    ? `, ${selection.customBuildingName}`
    : "";
  return `${selection.customCondoName}${building}`;
}

export async function createOrderFromCart(input: CreateOrderInput) {
  const { userId, deliverySelection } = input;
  const profile = await getUserProfile(userId);
  if (!profile) {
    throw new Error("Profile not found");
  }

  const userNameRow = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const userName = userNameRow[0]?.name ?? "Customer";

  const cart = await getActiveCartForUser(userId);
  if (!cart || cart.items.length === 0) {
    throw new Error("Cart is empty");
  }

  const bangkokNow = nowUtc();
  const displayDay = bangkokDateString(bangkokNow);
  // Use UTC midnight so PostgreSQL stores the correct date
  // (PG DATE extracts the UTC date, not local date)
  const displayDayDate = new Date(`${displayDay}T00:00:00Z`);

  const subtotalValue = cart.subtotal;
  const subtotalString = toNumericString(subtotalValue);
  const totalAmountString = subtotalString;
  const status: OrderStatus = "order_processing";

  const deliveryLabel = await formatDeliveryLabel(deliverySelection);
  const isCustom = deliverySelection.mode === "custom";

  let orderId: string | null = null;
  let displayId: string | null = null;
  let displayCounter: number | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[createOrderFromCart] attempt",
        attempt + 1,
        "displayDay",
        displayDay,
        "userId",
        userId
      );
    }

    // Query using the same UTC midnight date for consistency
    const [counterRow] = await db
      .select({ displayCounter: orders.displayCounter })
      .from(orders)
      .where(eq(orders.displayDay, displayDayDate))
      .orderBy(desc(orders.displayCounter))
      .limit(1);

    const nextCounter = (counterRow?.displayCounter ?? 0) + 1;
    const nextDisplayId = `OR${String(nextCounter).padStart(4, "0")}`;

    try {
      const [createdOrder] = await db
        .insert(orders)
        .values({
          displayDay: displayDayDate,
          displayCounter: nextCounter,
          displayId: nextDisplayId,
          cartId: cart.id,
          userId,
          sessionToken: cart.sessionToken ?? null,
          status,
          totalItems: cart.items.length,
          subtotal: subtotalString,
          discountTotal: "0.00",
          totalAmount: totalAmountString,
          customerName: userName,
          customerPhone: profile.phoneNumber,
          deliveryMode: deliverySelection.mode,
          deliveryLocationId:
            deliverySelection.mode === "preset"
              ? deliverySelection.locationId
              : null,
          deliveryBuildingId:
            deliverySelection.mode === "preset"
              ? deliverySelection.buildingId
              : null,
          customCondoName: isCustom ? deliverySelection.customCondoName : null,
          customBuildingName: isCustom
            ? deliverySelection.customBuildingName ?? null
            : null,
          customPlaceId: isCustom ? deliverySelection.placeId ?? null : null,
          customLat:
            isCustom && deliverySelection.coordinates
              ? deliverySelection.coordinates.lat
              : null,
          customLng:
            isCustom && deliverySelection.coordinates
              ? deliverySelection.coordinates.lng
              : null,
          deliveryNotes: null,
          orderNote: null,
          isClosed: false,
        })
        .onConflictDoNothing({
          target: [orders.displayDay, orders.displayCounter],
        })
        .returning();

      if (!createdOrder) {
        continue;
      }

      orderId = createdOrder.id;
      displayId = createdOrder.displayId;
      displayCounter = createdOrder.displayCounter;
      break;
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[createOrderFromCart] insert failed", {
          attempt,
          error,
          displayDay,
        });
      }
      const message = error instanceof Error ? error.message : String(error);
      const conflict =
        message.includes("orders_display_day_counter_unique") ||
        message.includes("display_day_counter_unique");

      if (conflict && attempt < 4) {
        continue;
      }

      throw error;
    }
  }

  if (!orderId || !displayId || displayCounter == null) {
    throw new Error("Order creation failed");
  }

  try {
    if (process.env.NODE_ENV !== "production") {
      console.log("[createOrderFromCart] inserting items for order", {
        orderId,
        itemCount: cart.items.length,
      });
    }
    const orderItemRows = [];
    for (const [index, item] of cart.items.entries()) {
      const [orderItem] = await db
        .insert(orderItems)
        .values({
          orderId,
          menuItemId: item.menuItemId,
          menuItemName: item.menuItemName,
          menuItemNameMm: item.menuItemNameMm,
          menuCode: item.menuCode ?? null,
          basePrice: toNumericString(item.basePrice),
          addonsTotal: toNumericString(item.addonsTotal),
          quantity: item.quantity,
          note: item.note,
          totalPrice: toNumericString(item.totalPrice),
          displayOrder: index,
        })
        .returning({ id: orderItems.id });

      if (!orderItem) {
        throw new Error("Failed to create order item");
      }

      orderItemRows.push({ id: orderItem.id, source: item });
    }

    for (const row of orderItemRows) {
      const item = row.source;
      if (item.choices && item.choices.length > 0) {
        await db.insert(orderItemChoices).values(
          item.choices.map((choice) => ({
            orderItemId: row.id,
            groupName: choice.groupName,
            groupNameMm: choice.groupNameMm,
            optionName: choice.optionName,
            optionNameMm: choice.optionNameMm,
            extraPrice: toNumericString(choice.extraPrice),
          }))
        );
      }
    }

    await db
      .update(carts)
      .set({ status: "submitted", updatedAt: bangkokNow })
      .where(eq(carts.id, cart.id));

    // Clear cart items so user can reuse the cart
    const cartItemIds = cart.items.map((item) => item.id);
    if (cartItemIds.length > 0) {
      await db.delete(cartItemChoices).where(inArray(cartItemChoices.cartItemId, cartItemIds));
      await db.delete(cartItems).where(inArray(cartItems.id, cartItemIds));
    }

    await db.insert(orderEvents).values({
      orderId,
      actorType: "user",
      actorId: userId,
      eventType: "order_submitted",
      fromStatus: null,
      toStatus: status,
      metadata: { displayId },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[createOrderFromCart] post-insert failure, cleaning up", {
        orderId,
        error,
      });
    }
    await db.delete(orders).where(eq(orders.id, orderId)).catch(() => null);
    throw error;
  }

  const submittedPayload: OrderSubmittedPayload = {
    orderId,
    displayId,
    customerName: userName,
    customerPhone: profile.phoneNumber,
    deliveryLabel,
    totalAmount: Number(totalAmountString),
    status,
    submittedAt: bangkokNow.toISOString(),
  };

  await broadcastOrderSubmitted(submittedPayload);

  return { orderId, displayId };
}
