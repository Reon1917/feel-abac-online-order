import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addSetMenuToCart, summarizeCartRecord } from "@/lib/cart/queries";
import { resolveUserId } from "@/lib/api/require-user";
import { getShopStatus } from "@/lib/shop/queries";

const setMenuSelectionSchema = z.object({
  poolLinkId: z.string().uuid(),
  optionId: z.string().uuid(),
});

const addSetMenuToCartSchema = z.object({
  menuItemId: z.string().uuid("Menu item ID is required"),
  quantity: z.number().int().min(1).max(20),
  note: z.string().max(500).nullable().optional(),
  selections: z.array(setMenuSelectionSchema).min(1, "At least one selection is required"),
});

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

  const payload = await request.json().catch(() => null);

  const parsed = addSetMenuToCartSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const cart = await addSetMenuToCart({
      ...parsed.data,
      userId,
    });
    const summary = summarizeCartRecord(cart);
    return NextResponse.json({
      summary,
      message: "Set menu added to cart",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to add set menu to cart.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
