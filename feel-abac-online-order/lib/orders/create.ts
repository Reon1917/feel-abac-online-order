import "server-only";

import { eq, inArray, sql } from "drizzle-orm";

import { db } from "@/src/db/client";
import { dbTx } from "@/src/db/tx-client";
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
import { getPusherServer } from "@/lib/pusher/server";
import {
  ADMIN_ORDERS_CHANNEL,
  ORDER_SUBMITTED_EVENT,
  buildOrderChannelName,
} from "./events";

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

/**
 * Broadcast order submitted event with retry logic.
 * Calls Pusher directly to detect failures (unlike broadcastOrderSubmitted which swallows errors).
 * If all retries fail, logs the error but doesn't throw to avoid failing order creation.
 * In production, consider implementing an outbox pattern for guaranteed delivery.
 */
async function broadcastWithRetry(
  payload: OrderSubmittedPayload,
  context: { orderId: string; displayId: string },
  maxRetries = 3
): Promise<void> {
  let lastError: unknown = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const pusher = getPusherServer();
      const channels = [
        ADMIN_ORDERS_CHANNEL,
        buildOrderChannelName(payload.displayId),
      ];
      
      const batch = channels.map((channel) => ({
        channel,
        name: ORDER_SUBMITTED_EVENT,
        data: payload,
      }));
      
      await pusher.triggerBatch(batch);
      // Success - exit early
      return;
    } catch (error) {
      lastError = error;
      
      if (process.env.NODE_ENV !== "production") {
        console.error("[createOrderFromCart] broadcast attempt failed", {
          attempt: attempt + 1,
          maxRetries,
          orderId: context.orderId,
          displayId: context.displayId,
          error,
        });
      }
      
      // Don't retry on last attempt
      if (attempt < maxRetries - 1) {
        // Exponential backoff: 100ms, 200ms, 400ms
        const delayMs = 100 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  
  // All retries exhausted - log final failure
  if (process.env.NODE_ENV !== "production") {
    console.error("[createOrderFromCart] broadcast failed after all retries", {
      orderId: context.orderId,
      displayId: context.displayId,
      error: lastError,
    });
  }
  
  // TODO: Implement outbox pattern for reliable event delivery
  // Option 1: Insert into an outbox table for async retry processing
  // Option 2: Enqueue to a job queue (BullMQ, Bull, etc.)
  // Option 3: Use a transactional outbox pattern with DB polling
  // This ensures events are eventually delivered even if Pusher is temporarily unavailable
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
  const result = await dbTx.transaction(
    async (tx): Promise<{ orderId: string; displayId: string; submittedPayload: OrderSubmittedPayload }> => {
      let orderId: string | null = null;
      let displayId: string | null = null;
      let displayCounter: number | null = null;

      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const insertResult = await tx.execute<{
            id: string;
            display_id: string;
            display_counter: number;
          }>(sql`
            INSERT INTO orders (
              display_day,
              display_counter,
              display_id,
              cart_id,
              user_id,
              session_token,
              status,
              total_items,
              subtotal,
              discount_total,
              total_amount,
              customer_name,
              customer_phone,
              delivery_mode,
              delivery_location_id,
              delivery_building_id,
              custom_condo_name,
              custom_building_name,
              custom_place_id,
              custom_lat,
              custom_lng,
              delivery_notes,
              order_note,
              is_closed
            )
            SELECT
              ${displayDayDate}::date,
              COALESCE(MAX(display_counter), 0) + 1 AS display_counter,
              CONCAT('OR', LPAD((COALESCE(MAX(display_counter), 0) + 1)::text, 4, '0')) AS display_id,
              ${cart.id},
              ${userId},
              ${cart.sessionToken ?? null},
              ${status},
              ${cart.items.length},
              ${subtotalString},
              '0.00',
              ${totalAmountString},
              ${userName},
              ${profile.phoneNumber},
              ${deliverySelection.mode},
              ${deliverySelection.mode === "preset" ? deliverySelection.locationId : null},
              ${deliverySelection.mode === "preset" ? deliverySelection.buildingId : null},
              ${isCustom ? deliverySelection.customCondoName : null},
              ${isCustom ? deliverySelection.customBuildingName ?? null : null},
              ${isCustom ? deliverySelection.placeId ?? null : null},
              ${
                isCustom && deliverySelection.coordinates
                  ? deliverySelection.coordinates.lat
                  : null
              },
              ${
                isCustom && deliverySelection.coordinates
                  ? deliverySelection.coordinates.lng
                  : null
              },
              null,
              null,
              false
            FROM orders
            WHERE display_day = ${displayDayDate}
            ON CONFLICT (display_day, display_counter) DO NOTHING
            RETURNING id, display_id, display_counter;
          `);

          const createdOrder = insertResult.rows?.[0];

          if (!createdOrder) {
            if (process.env.NODE_ENV !== "production") {
              console.warn("[createOrderFromCart] counter conflict, retrying", {
                attempt,
                displayDay,
              });
            }
            continue;
          }

          orderId = createdOrder.id;
          displayId = createdOrder.display_id;
          displayCounter = createdOrder.display_counter;
          break;
        } catch (error) {
          if (process.env.NODE_ENV !== "production") {
            console.error("[createOrderFromCart] insert failed", {
              attempt,
              error,
              displayDay,
            });
          }
          throw error;
        }
      }

      if (!orderId || !displayId || displayCounter == null) {
        throw new Error("Order creation failed");
      }

      if (process.env.NODE_ENV !== "production") {
        console.log("[createOrderFromCart] inserting items for order", {
          orderId,
          itemCount: cart.items.length,
        });
      }

      const orderItemValues = cart.items.map((item, index) => ({
        orderId,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItemName,
        menuItemNameMm: item.menuItemNameMm,
        menuCode: null,
        basePrice: toNumericString(item.basePrice),
        addonsTotal: toNumericString(item.addonsTotal),
        quantity: item.quantity,
        note: item.note,
        totalPrice: toNumericString(item.totalPrice),
        displayOrder: index,
      }));

      const insertedItems = await tx
        .insert(orderItems)
        .values(orderItemValues)
        .returning({ id: orderItems.id });

      if (insertedItems.length !== orderItemValues.length) {
        throw new Error("Failed to create order items");
      }

      const choiceValues: Array<{
        orderItemId: string;
        groupName: string;
        groupNameMm: string | null;
        optionName: string;
        optionNameMm: string | null;
        extraPrice: string;
      }> = [];
      insertedItems.forEach((row, idx) => {
        const source = cart.items[idx];
        if (source.choices && source.choices.length > 0) {
          for (const choice of source.choices) {
            choiceValues.push({
              orderItemId: row.id,
              groupName: choice.groupName,
              groupNameMm: choice.groupNameMm,
              optionName: choice.optionName,
              optionNameMm: choice.optionNameMm,
              extraPrice: toNumericString(choice.extraPrice),
            });
          }
        }
      });

      if (choiceValues.length > 0) {
        await tx.insert(orderItemChoices).values(choiceValues);
      }

      await tx
        .update(carts)
        .set({ status: "submitted", updatedAt: bangkokNow })
        .where(eq(carts.id, cart.id));

      const cartItemIds = cart.items.map((item) => item.id);
      if (cartItemIds.length > 0) {
        await tx
          .delete(cartItemChoices)
          .where(inArray(cartItemChoices.cartItemId, cartItemIds));
        await tx.delete(cartItems).where(inArray(cartItems.id, cartItemIds));
      }

      const [submittedEvent] = await tx
        .insert(orderEvents)
        .values({
          orderId,
          actorType: "user",
          actorId: userId,
          eventType: "order_submitted",
          fromStatus: null,
          toStatus: status,
          metadata: { displayId },
        })
        .returning({ id: orderEvents.id });

      const submittedPayload: OrderSubmittedPayload = {
        eventId: submittedEvent?.id ?? "",
        orderId,
        displayId,
        displayDay,
        customerName: userName,
        customerPhone: profile.phoneNumber,
        deliveryLabel,
        totalAmount: Number(totalAmountString),
        status,
        at: bangkokNow.toISOString(),
      };

      // Return payload to broadcast after transaction commits
      return { orderId, displayId, submittedPayload };
    }
  );

  // Broadcast only after transaction has successfully committed
  // This ensures DB writes are persisted even if broadcast fails
  await broadcastWithRetry(result.submittedPayload, {
    orderId: result.orderId,
    displayId: result.displayId,
  });

  return { orderId: result.orderId, displayId: result.displayId };
}
