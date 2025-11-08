import "server-only";

import { and, eq, inArray, sum } from "drizzle-orm";

import { db } from "@/src/db/client";
import { cartItemChoices, cartItems, carts } from "@/src/db/schema";
import { getPublicMenuItemById } from "@/lib/menu/queries";
import { generateCartItemHash } from "./hash";
import {
  AddToCartInput,
  AddToCartSelection,
  CartItemChoice,
  CartItemRecord,
  CartRecord,
  CartSummary,
  MAX_QUANTITY_PER_LINE,
  RemoveCartItemInput,
  UpdateCartItemInput,
} from "./types";

function numericToNumber(value: string | null): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNumericString(value: number) {
  return value.toFixed(2);
}

async function loadCartItems(cartId: string): Promise<CartItemRecord[]> {
  const items = await db
    .select()
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId))
    .orderBy(cartItems.createdAt);

  if (items.length === 0) {
    return [];
  }

  const itemIds = items.map((item) => item.id);

  const choiceRecords = await db
    .select()
    .from(cartItemChoices)
    .where(inArray(cartItemChoices.cartItemId, itemIds));

  const choicesByItem = new Map<string, CartItemChoice[]>();
  for (const choice of choiceRecords) {
    const normalized: CartItemChoice = {
      id: choice.id,
      cartItemId: choice.cartItemId,
      groupName: choice.groupName,
      groupNameMm: choice.groupNameMm,
      optionName: choice.optionName,
      optionNameMm: choice.optionNameMm,
      extraPrice: numericToNumber(choice.extraPrice),
    };
    const current = choicesByItem.get(choice.cartItemId) ?? [];
    current.push(normalized);
    choicesByItem.set(choice.cartItemId, current);
  }

  return items.map<CartItemRecord>((item) => ({
    id: item.id,
    cartId: item.cartId,
    menuItemId: item.menuItemId,
    menuItemName: item.menuItemName,
    menuItemNameMm: item.menuItemNameMm,
    basePrice: numericToNumber(item.basePrice),
    addonsTotal: numericToNumber(item.addonsTotal),
    quantity: item.quantity,
    note: item.note,
    totalPrice: numericToNumber(item.totalPrice),
    hashKey: item.hashKey,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    choices: choicesByItem.get(item.id) ?? [],
  }));
}

function mapCartRecord(
  cart: typeof carts.$inferSelect,
  items: CartItemRecord[]
): CartRecord {
  const subtotal = numericToNumber(cart.subtotal);
  return {
    id: cart.id,
    userId: cart.userId,
    sessionToken: cart.sessionToken ?? null,
    status: cart.status,
    subtotal,
    lastActivityAt: cart.lastActivityAt,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
    items,
  };
}

export function summarizeCartRecord(cart: CartRecord): CartSummary {
  const itemCount = cart.items.length;
  const totalQuantity = cart.items.reduce(
    (total, item) => total + item.quantity,
    0
  );

  return {
    id: cart.id,
    subtotal: cart.subtotal,
    itemCount,
    totalQuantity,
  };
}

export async function getActiveCartForUser(
  userId: string
): Promise<CartRecord | null> {
  const [cart] = await db
    .select()
    .from(carts)
    .where(and(eq(carts.userId, userId), eq(carts.status, "active")))
    .limit(1);

  if (!cart) {
    return null;
  }

  const items = await loadCartItems(cart.id);
  return mapCartRecord(cart, items);
}

export async function getActiveCartSummary(
  userId: string
): Promise<CartSummary | null> {
  const cart = await getActiveCartForUser(userId);
  if (!cart) {
    return null;
  }
  return summarizeCartRecord(cart);
}

async function ensureActiveCart(userId: string) {
  const [existing] = await db
    .select()
    .from(carts)
    .where(and(eq(carts.userId, userId), eq(carts.status, "active")))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(carts)
    .values({
      userId,
      status: "active",
    })
    .returning();

  if (!created) {
    throw new Error("Unable to create a cart");
  }

  return created;
}

async function recalculateCartTotals(cartId: string) {
  const [result] = await db
    .select({
      total: sum(cartItems.totalPrice),
    })
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId));

  const subtotalValue = numericToNumber(result?.total ?? "0");

  await db
    .update(carts)
    .set({
      subtotal: toNumericString(subtotalValue),
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(carts.id, cartId));
}

async function getCartItemForUser(userId: string, cartItemId: string) {
  const [record] = await db
    .select({
      item: cartItems,
      cart: carts,
    })
    .from(cartItems)
    .innerJoin(carts, eq(cartItems.cartId, carts.id))
    .where(
      and(
        eq(cartItems.id, cartItemId),
        eq(carts.userId, userId),
        eq(carts.status, "active")
      )
    )
    .limit(1);

  return record ?? null;
}

function validateSelections(selections: AddToCartSelection[]) {
  if (selections.length === 0) {
    return [];
  }

  const map = new Map<string, string[]>();

  for (const selection of selections) {
    const uniqueOptionIds = Array.from(new Set(selection.optionIds)).filter(
      (id) => typeof id === "string" && id.trim().length > 0
    );
    if (uniqueOptionIds.length === 0) {
      continue;
    }
    map.set(selection.groupId, uniqueOptionIds);
  }

  return Array.from(map.entries()).map(([groupId, optionIds]) => ({
    groupId,
    optionIds,
  }));
}

function ensureGroupSelections(
  item: NonNullable<Awaited<ReturnType<typeof getPublicMenuItemById>>>["item"],
  selections: AddToCartSelection[]
) {
  const selectionMap = new Map(
    selections.map((selection) => [selection.groupId, selection.optionIds])
  );

  const choiceDetails: Array<{
    groupId: string;
    groupName: string;
    groupNameMm: string | null;
    optionId: string;
    optionName: string;
    optionNameMm: string | null;
    extraPrice: number;
  }> = [];

  for (const group of item.choiceGroups) {
    const selectedIds = selectionMap.get(group.id) ?? [];

    const minRequired = Math.max(group.minSelect, group.isRequired ? 1 : 0);
    if (minRequired > 0 && selectedIds.length < minRequired) {
      throw new Error("Missing required selections for this item.");
    }

    const maxAllowed = group.maxSelect > 0 ? group.maxSelect : Number.MAX_SAFE_INTEGER;
    if (selectedIds.length > maxAllowed) {
      throw new Error("Too many choices selected for this group.");
    }

    if (selectedIds.length === 0) {
      continue;
    }

    const availableOptions = new Map(
      group.options.map((option) => [option.id, option])
    );

    for (const optionId of selectedIds) {
      const option = availableOptions.get(optionId);
      if (!option) {
        throw new Error("Invalid choice selection.");
      }

      choiceDetails.push({
        groupId: group.id,
        groupName: group.title,
        groupNameMm: group.titleMm,
        optionId,
        optionName: option.name,
        optionNameMm: option.nameMm ?? null,
        extraPrice: option.extraPrice,
      });
    }
  }

  for (const selection of selections) {
    const groupExists = item.choiceGroups.some(
      (group) => group.id === selection.groupId
    );
    if (!groupExists) {
      throw new Error("Invalid choice group selected.");
    }
  }

  return choiceDetails;
}

export async function addItemToCart(input: AddToCartInput) {
  const { userId, menuItemId, quantity, note } = input;

  if (!userId) {
    throw new Error("User is required to add items to the cart.");
  }

  const menuResult = await getPublicMenuItemById(menuItemId);
  if (!menuResult) {
    throw new Error("Menu item is no longer available.");
  }

  const item = menuResult.item;

  const sanitizedSelections = validateSelections(input.selections);
  const choiceDetails = ensureGroupSelections(item, sanitizedSelections);

  const normalizedNote =
    item.allowUserNotes && note ? note.trim().slice(0, 280) : null;

  if (quantity > MAX_QUANTITY_PER_LINE) {
    throw new Error("Quantity exceeds the allowed limit for a single item.");
  }

  const cart = await ensureActiveCart(userId);
  const hashKey = generateCartItemHash(
    item.id,
    sanitizedSelections,
    normalizedNote
  );

  const [existingItem] = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.hashKey, hashKey)))
    .limit(1);

  const addonsTotal = choiceDetails.reduce(
    (total, choice) => total + choice.extraPrice,
    0
  );
  const unitTotal = item.price + addonsTotal;
  const lineTotal = unitTotal * quantity;

  if (existingItem) {
    const storedBase = numericToNumber(existingItem.basePrice);
    const storedAddons = numericToNumber(existingItem.addonsTotal);
    const storedUnitTotal = storedBase + storedAddons;

    const nextQuantity = existingItem.quantity + quantity;
    if (nextQuantity > MAX_QUANTITY_PER_LINE) {
      throw new Error(
        `You can only add up to ${MAX_QUANTITY_PER_LINE} of this configuration.`
      );
    }

    await db
      .update(cartItems)
      .set({
        quantity: nextQuantity,
        totalPrice: toNumericString(storedUnitTotal * nextQuantity),
        updatedAt: new Date(),
      })
      .where(eq(cartItems.id, existingItem.id));
  } else {
    const [insertedItem] = await db
      .insert(cartItems)
      .values({
        cartId: cart.id,
        menuItemId: item.id,
        menuItemName: item.name,
        menuItemNameMm: item.nameMm,
        basePrice: toNumericString(item.price),
        addonsTotal: toNumericString(addonsTotal),
        quantity,
        note: normalizedNote,
        hashKey,
        totalPrice: toNumericString(lineTotal),
      })
      .returning();

    if (!insertedItem) {
      throw new Error("Unable to add item to cart.");
    }

    if (choiceDetails.length > 0) {
      try {
        await db.insert(cartItemChoices).values(
          choiceDetails.map((choice) => ({
            cartItemId: insertedItem.id,
            groupName: choice.groupName,
            groupNameMm: choice.groupNameMm,
            optionName: choice.optionName,
            optionNameMm: choice.optionNameMm,
            extraPrice: String(choice.extraPrice),
          }))
        );
      } catch (error) {
        await db.delete(cartItems).where(eq(cartItems.id, insertedItem.id));
        throw new Error(
          error instanceof Error
            ? error.message
            : "Unable to add item to cart."
        );
      }
    }
  }

  await recalculateCartTotals(cart.id);

  const refreshedCart = await getActiveCartForUser(userId);
  if (!refreshedCart) {
    throw new Error("Unable to refresh cart after update.");
  }

  return summarizeCartRecord(refreshedCart);
}

export async function updateCartItemQuantity(
  input: UpdateCartItemInput
) {
  const { userId, cartItemId, quantity } = input;
  const record = await getCartItemForUser(userId, cartItemId);
  if (!record) {
    throw new Error("Cart item not found.");
  }

  const unitPrice =
    numericToNumber(record.item.basePrice) +
    numericToNumber(record.item.addonsTotal);

  if (quantity <= 0) {
    await db.delete(cartItems).where(eq(cartItems.id, cartItemId));
  } else {
    const cappedQuantity = Math.min(quantity, MAX_QUANTITY_PER_LINE);

    await db
      .update(cartItems)
      .set({
        quantity: cappedQuantity,
        totalPrice: toNumericString(unitPrice * cappedQuantity),
        updatedAt: new Date(),
      })
      .where(eq(cartItems.id, cartItemId));
  }

  await recalculateCartTotals(record.cart.id);

  const refreshed = await getActiveCartForUser(userId);
  if (!refreshed) {
    throw new Error("Unable to refresh cart.");
  }
  return refreshed;
}

export async function removeCartItem(input: RemoveCartItemInput) {
  const { userId, cartItemId } = input;
  const record = await getCartItemForUser(userId, cartItemId);
  if (!record) {
    throw new Error("Cart item not found.");
  }

  await db.delete(cartItems).where(eq(cartItems.id, cartItemId));
  await recalculateCartTotals(record.cart.id);

  const refreshed = await getActiveCartForUser(userId);
  if (!refreshed) {
    throw new Error("Unable to refresh cart.");
  }
  return refreshed;
}
