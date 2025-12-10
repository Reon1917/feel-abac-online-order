import { NextRequest, NextResponse } from "next/server";

import {
  removeCartItem,
  updateCartItemQuantity,
} from "@/lib/cart/queries";
import { updateCartItemSchema } from "@/lib/cart/validation";
import { resolveUserId } from "@/lib/api/require-user";
import { getShopStatus } from "@/lib/shop/queries";

type RouteContext = {
  params: Promise<{
    itemId: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shopStatus = await getShopStatus();
  if (!shopStatus.isOpen) {
    return NextResponse.json(
      { error: shopStatus.closedMessageEn ?? "Shop is currently closed" },
      { status: 403 }
    );
  }

  const { itemId } = await context.params;
  const normalizedId = itemId?.trim();
  if (!normalizedId) {
    return NextResponse.json(
      { error: "Cart item ID is required" },
      { status: 400 }
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = updateCartItemSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const cart = await updateCartItemQuantity({
      userId,
      cartItemId: normalizedId,
      quantity: parsed.data.quantity,
    });
    return NextResponse.json({ cart });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update item.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shopStatus = await getShopStatus();
  if (!shopStatus.isOpen) {
    return NextResponse.json(
      { error: shopStatus.closedMessageEn ?? "Shop is currently closed" },
      { status: 403 }
    );
  }

  const { itemId } = await context.params;
  const normalizedId = itemId?.trim();
  if (!normalizedId) {
    return NextResponse.json(
      { error: "Cart item ID is required" },
      { status: 400 }
    );
  }

  try {
    const cart = await removeCartItem({
      userId,
      cartItemId: normalizedId,
    });
    return NextResponse.json({ cart });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to remove item.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
