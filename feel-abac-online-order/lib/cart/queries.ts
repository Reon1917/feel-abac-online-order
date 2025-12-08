import "server-only";

import crypto from "node:crypto";
import { and, eq, inArray, sum, sql } from "drizzle-orm";
import { numericToNumber } from "@/lib/db/numeric";

import { db } from "@/src/db/client";
import { cartItemChoices, cartItems, carts } from "@/src/db/schema";
import { getPublicMenuItemById } from "@/lib/menu/queries";
import { generateCartItemHash } from "./hash";
import {
  AddToCartInput,
  AddToCartSelection,
  AddSetMenuToCartInput,
  SetMenuSelection,
  CartItemChoice,
  CartItemRecord,
  CartRecord,
  CartSummary,
  MAX_QUANTITY_PER_LINE,
  RemoveCartItemInput,
  UpdateCartItemInput,
} from "./types";
import { getPoolLinksForMenuItem } from "@/lib/menu/pool-queries";

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
      selectionRole: choice.selectionRole as CartItemChoice["selectionRole"],
      menuCode: choice.menuCode,
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
  const [cart] = await db
    .select({ id: carts.id, subtotal: carts.subtotal })
    .from(carts)
    .where(and(eq(carts.userId, userId), eq(carts.status, "active")))
    .limit(1);

  if (!cart) {
    return null;
  }

  return buildCartSummaryFromRow(cart.id, cart.subtotal);
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
  const subtotalString = toNumericString(subtotalValue);

  await db
    .update(carts)
    .set({
      subtotal: subtotalString,
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(carts.id, cartId));

  return subtotalString;
}

async function getCartQuantityStats(cartId: string) {
  const [stats] = await db
    .select({
      itemCount: sql<number>`COUNT(*)`,
      totalQuantity: sum(cartItems.quantity),
    })
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId));

  return {
    itemCount: Number(stats?.itemCount ?? 0),
    totalQuantity: Number(stats?.totalQuantity ?? 0),
  };
}

async function buildCartSummaryFromRow(cartId: string, subtotalValue: string | null): Promise<CartSummary> {
  const { itemCount, totalQuantity } = await getCartQuantityStats(cartId);
  return {
    id: cartId,
    subtotal: numericToNumber(subtotalValue ?? "0"),
    itemCount,
    totalQuantity,
  };
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
  const summary = await addItemsToCart([input]);
  return summary;
}

type ChoiceDetail = {
  groupId: string;
  groupName: string;
  groupNameMm: string | null;
  optionId: string;
  optionName: string;
  optionNameMm: string | null;
  extraPrice: number;
};

type InsertCartLinePlan = {
  type: "insert";
  cartItemId: string;
  menuItemId: string;
  menuItemName: string;
  menuItemNameMm: string | null;
  basePrice: number;
  addonsTotal: number;
  unitTotal: number;
  quantity: number;
  note: string | null;
  hashKey: string;
  choices: ChoiceDetail[];
};

type IncrementCartLinePlan = {
  type: "increment";
  cartItemId: string;
  unitTotal: number;
  delta: number;
  plannedQuantity: number;
};

type CartLinePlan = InsertCartLinePlan | IncrementCartLinePlan;

function isInsertPlan(plan: CartLinePlan): plan is InsertCartLinePlan {
  return plan.type === "insert";
}

export async function addItemsToCart(inputs: AddToCartInput[]) {
  if (!inputs.length) {
    throw new Error("At least one item is required.");
  }

  const userId = inputs[0]?.userId;

  if (!userId) {
    throw new Error("User is required to add items to the cart.");
  }

  const mismatchedUser = inputs.find((entry) => entry.userId !== userId);
  if (mismatchedUser) {
    throw new Error("All items must belong to the same user.");
  }

  const cart = await ensureActiveCart(userId);

  const plans = await buildCartLinePlans(cart.id, inputs);

  type DbBatchInput = Parameters<typeof db.batch>[0];
  type BatchStatement = DbBatchInput[number];
  const statements: BatchStatement[] = [];
  const insertedCartItemIds: string[] = [];
  const incrementStatementIndexes: number[] = [];

  for (const plan of plans.values()) {
    if (isInsertPlan(plan)) {
      insertedCartItemIds.push(plan.cartItemId);
      statements.push(
        db.insert(cartItems).values({
          id: plan.cartItemId,
          cartId: cart.id,
          menuItemId: plan.menuItemId,
          menuItemName: plan.menuItemName,
          menuItemNameMm: plan.menuItemNameMm,
          basePrice: toNumericString(plan.basePrice),
          addonsTotal: toNumericString(plan.addonsTotal),
          quantity: plan.quantity,
          note: plan.note,
          hashKey: plan.hashKey,
          totalPrice: toNumericString(plan.unitTotal * plan.quantity),
        })
      );

      if (plan.choices.length > 0) {
        statements.push(
          db.insert(cartItemChoices).values(
            plan.choices.map((choice) => ({
              cartItemId: plan.cartItemId,
              groupName: choice.groupName,
              groupNameMm: choice.groupNameMm,
              optionName: choice.optionName,
              optionNameMm: choice.optionNameMm,
              extraPrice: toNumericString(choice.extraPrice),
            }))
          )
        );
      }
    } else {
      const deltaParam = plan.delta;
      const unitTotalParam = plan.unitTotal;
      const statement = db
        .update(cartItems)
        .set({
          quantity: sql`${cartItems.quantity} + ${deltaParam}`,
          totalPrice: sql`${cartItems.totalPrice} + ${toNumericString(
            unitTotalParam * deltaParam
          )}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(cartItems.id, plan.cartItemId),
            sql`${cartItems.quantity} + ${deltaParam} <= ${MAX_QUANTITY_PER_LINE}`
          )
        )
        .returning({ quantity: cartItems.quantity });
      const index = statements.push(statement) - 1;
      incrementStatementIndexes.push(index);
    }
  }

  if (statements.length === 0) {
    const subtotal = await buildCartSummaryFromRow(cart.id, cart.subtotal);
    return subtotal;
  }

  let results: unknown[];
  try {
    results = (await db.batch(
      statements as [BatchStatement, ...BatchStatement[]]
    )) as unknown[];
  } catch (error) {
    if (
      error instanceof Error &&
      /unique|duplicate/i.test(error.message ?? "")
    ) {
      return addItemsToCart(inputs);
    }
    throw error;
  }

  let incrementFailure = false;
  for (const index of incrementStatementIndexes) {
    const row = results[index] as Array<{ quantity: number }>;
    if (!row || row.length === 0) {
      incrementFailure = true;
      break;
    }
  }

  if (incrementFailure) {
    if (insertedCartItemIds.length > 0) {
      await db
        .delete(cartItemChoices)
        .where(inArray(cartItemChoices.cartItemId, insertedCartItemIds));
      await db
        .delete(cartItems)
        .where(inArray(cartItems.id, insertedCartItemIds));
    }
    await recalculateCartTotals(cart.id);
    throw new Error(
      `You can only add up to ${MAX_QUANTITY_PER_LINE} of this configuration.`
    );
  }

  const nextSubtotal = await recalculateCartTotals(cart.id);

  const summary = await buildCartSummaryFromRow(cart.id, nextSubtotal);
  return summary;
}

async function buildCartLinePlans(cartId: string, inputs: AddToCartInput[]) {
  const plans = new Map<string, CartLinePlan>();

  for (const input of inputs) {
    const { menuItemId, quantity, note } = input;

    if (quantity > MAX_QUANTITY_PER_LINE) {
      throw new Error("Quantity exceeds the allowed limit for a single item.");
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

    const hashKey = generateCartItemHash(
      item.id,
      sanitizedSelections,
      normalizedNote
    );

    const existingPlan = plans.get(hashKey);
    if (existingPlan) {
      if (isInsertPlan(existingPlan)) {
        const nextQuantity = existingPlan.quantity + quantity;
        if (nextQuantity > MAX_QUANTITY_PER_LINE) {
          throw new Error(
            `You can only add up to ${MAX_QUANTITY_PER_LINE} of this configuration.`
          );
        }
        existingPlan.quantity = nextQuantity;
      } else {
        const nextQuantity = existingPlan.plannedQuantity + quantity;
        if (nextQuantity > MAX_QUANTITY_PER_LINE) {
          throw new Error(
            `You can only add up to ${MAX_QUANTITY_PER_LINE} of this configuration.`
          );
        }
        existingPlan.delta += quantity;
        existingPlan.plannedQuantity = nextQuantity;
      }
      continue;
    }

    const [existingItem] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.cartId, cartId), eq(cartItems.hashKey, hashKey)))
      .limit(1);

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

      plans.set(hashKey, {
        type: "increment",
        cartItemId: existingItem.id,
        unitTotal: storedUnitTotal,
        delta: quantity,
        plannedQuantity: nextQuantity,
      });
      continue;
    }

    const addonsTotal = choiceDetails.reduce(
      (total, choice) => total + choice.extraPrice,
      0
    );
    const unitTotal = item.price + addonsTotal;

  plans.set(hashKey, {
    type: "insert",
    cartItemId: crypto.randomUUID(),
    menuItemId: item.id,
    menuItemName: item.name,
    menuItemNameMm: item.nameMm,
    basePrice: item.price,
    addonsTotal,
    unitTotal,
    quantity,
    note: normalizedNote,
    hashKey,
    choices: choiceDetails,
  });
  }

  return plans;
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
    if (quantity > MAX_QUANTITY_PER_LINE) {
      throw new Error(
        `You can only add up to ${MAX_QUANTITY_PER_LINE} of this configuration.`
      );
    }

    await db
      .update(cartItems)
      .set({
        quantity,
        totalPrice: toNumericString(unitPrice * quantity),
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

// ===== SET MENU CART FUNCTIONS =====

function generateSetMenuHash(
  menuItemId: string,
  selections: { kind: "base" | "addon"; optionId: string }[],
  note?: string | null
): string {
  const sortedSelections = [...selections]
    .sort((a, b) => a.optionId.localeCompare(b.optionId))
    .map((s) => `${s.kind}:${s.optionId}`);

  const parts = [
    `item:${menuItemId}`,
    `selections:${sortedSelections.join("|")}`,
    `note:${note ?? ""}`,
  ];

  return crypto.createHash("md5").update(parts.join("::")).digest("hex");
}

export async function addSetMenuToCart(
  input: AddSetMenuToCartInput
): Promise<CartRecord> {
  const { userId, menuItemId, quantity, note, selections } = input;

  if (quantity < 1 || quantity > MAX_QUANTITY_PER_LINE) {
    throw new Error(`Quantity must be between 1 and ${MAX_QUANTITY_PER_LINE}.`);
  }

  // Get the menu item to verify it's a set menu
  const itemData = await getPublicMenuItemById(menuItemId);
  if (!itemData) {
    throw new Error("Set menu item not found.");
  }
  if (!itemData.item.isSetMenu) {
    throw new Error("This item is not a set menu.");
  }

  // Get pool links to validate selections
  const poolLinks = await getPoolLinksForMenuItem(menuItemId);
  if (poolLinks.length === 0) {
    throw new Error("Set menu configuration is invalid.");
  }

  const poolLinksById = new Map(poolLinks.map((link) => [link.id, link]));

  type NormalizedSetMenuSelection = {
    link: (typeof poolLinks)[number];
    option: (typeof poolLinks)[number]["pool"]["options"][number];
    unitPrice: number;
    extraPrice: number;
  };

  const normalizedSelections: NormalizedSetMenuSelection[] = [];
  const selectedLinkIds = new Set<string>();
  const hashSelections: { kind: "base" | "addon"; optionId: string }[] = [];

  // Normalize selections against pool links and options from the DB.
  for (const selection of selections) {
    const link = poolLinksById.get(selection.poolLinkId);
    if (!link) {
      throw new Error("Invalid set menu selection.");
    }

    const option = link.pool.options.find(
      (opt) => opt.id === selection.optionId
    );
    if (!option) {
      throw new Error("Invalid option for set menu selection.");
    }
    if (!option.isAvailable) {
      throw new Error("Selected option is not available.");
    }

    selectedLinkIds.add(link.id);
    const selectionKind: "base" | "addon" = link.isPriceDetermining
      ? "base"
      : "addon";
    hashSelections.push({ kind: selectionKind, optionId: option.id });

    const isFlatPricing =
      !link.usesOptionPrice && link.flatPrice !== null;

    const unitPrice = isFlatPricing ? (link.flatPrice ?? 0) : option.price;
    const extraPrice = link.isPriceDetermining ? 0 : unitPrice;

    normalizedSelections.push({
      link,
      option,
      unitPrice,
      extraPrice,
    });
  }

  // Validate required selections using server-derived roles
  const requiredLinks = poolLinks.filter((link) => link.isRequired);
  for (const requiredLink of requiredLinks) {
    if (!selectedLinkIds.has(requiredLink.id)) {
      throw new Error(
        `Required selection missing: ${requiredLink.labelEn ?? requiredLink.id}`
      );
    }
  }

  // Calculate pricing
  let basePrice = 0;
  let addonsTotal = 0;

  for (const selection of normalizedSelections) {
    if (selection.link.isPriceDetermining) {
      // This is the base price (from base_curry)
      basePrice = selection.unitPrice;
    } else {
      // This is an addon
      addonsTotal += selection.unitPrice;
    }
  }

  const totalPrice = (basePrice + addonsTotal) * quantity;

  // Generate hash for deduplication
  const hashKey = generateSetMenuHash(
    menuItemId,
    hashSelections,
    note
  );

  // Ensure active cart
  const cart = await ensureActiveCart(userId);

  // Check for existing item with same hash
  const [existingItem] = await db
    .select()
    .from(cartItems)
    .where(
      and(
        eq(cartItems.cartId, cart.id),
        eq(cartItems.hashKey, hashKey)
      )
    )
    .limit(1);

  if (existingItem) {
    // Update quantity
    const newQuantity = Math.min(existingItem.quantity + quantity, MAX_QUANTITY_PER_LINE);
    const newTotal = (basePrice + addonsTotal) * newQuantity;

    await db
      .update(cartItems)
      .set({
        quantity: newQuantity,
        totalPrice: toNumericString(newTotal),
        updatedAt: new Date(),
      })
      .where(eq(cartItems.id, existingItem.id));
  } else {
    // Insert new cart item
    const [newCartItem] = await db
      .insert(cartItems)
      .values({
        cartId: cart.id,
        menuItemId,
        menuItemName: itemData.item.name,
        menuItemNameMm: itemData.item.nameMm,
        basePrice: toNumericString(basePrice),
        addonsTotal: toNumericString(addonsTotal),
        quantity,
        note: note ?? null,
        hashKey,
        totalPrice: toNumericString(totalPrice),
      })
      .returning();

    // Insert choices with set menu fields
    if (normalizedSelections.length > 0) {
      const choiceValues = normalizedSelections.map(
        ({ link, option, extraPrice }) => ({
          cartItemId: newCartItem.id,
          groupName: link.labelEn ?? link.pool.nameEn,
          groupNameMm: link.labelMm ?? link.pool.nameMm ?? null,
          optionName: option.nameEn,
          optionNameMm: option.nameMm,
          extraPrice: toNumericString(extraPrice),
          selectionRole: link.isPriceDetermining ? "base" : "addon",
          menuCode: option.menuCode,
        })
      );

      await db.insert(cartItemChoices).values(choiceValues);
    }
  }

  // Recalculate totals
  await recalculateCartTotals(cart.id);

  // Return updated cart
  const refreshedCart = await getActiveCartForUser(userId);
  if (!refreshedCart) {
    throw new Error("Unable to refresh cart.");
  }

  return refreshedCart;
}
