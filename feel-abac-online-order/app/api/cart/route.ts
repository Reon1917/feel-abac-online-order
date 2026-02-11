import { NextRequest, NextResponse } from "next/server";

import {
  addItemToCart,
  getActiveCartForUser,
  summarizeCartRecord,
} from "@/lib/cart/queries";
import { addToCartSchema } from "@/lib/cart/validation";
import { resolveUserId } from "@/lib/api/require-user";
import { getShopStatus } from "@/lib/shop/queries";
import { getLatestUnpaidOrderForUser } from "@/lib/orders/queries";
import { ACTIVE_ORDER_BLOCK_CODE } from "@/lib/orders/active-order";

export async function GET(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cart = await getActiveCartForUser(userId);
  const summary = cart ? summarizeCartRecord(cart) : null;

  return NextResponse.json({ cart, summary });
}

export async function POST(request: NextRequest) {
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

  const unpaidOrder = await getLatestUnpaidOrderForUser(userId);
  if (unpaidOrder) {
    return NextResponse.json(
      {
        error:
          "You can place a new order after payment for your current order is verified.",
        code: ACTIVE_ORDER_BLOCK_CODE,
        activeOrder: {
          displayId: unpaidOrder.displayId,
          status: unpaidOrder.status,
        },
      },
      { status: 409 }
    );
  }

  const payload = await request.json().catch(() => null);

  const parsed = addToCartSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const summary = await addItemToCart({
      ...parsed.data,
      userId,
    });
    return NextResponse.json({
      summary,
      message: "Item added to cart",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to add this item to your cart.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
