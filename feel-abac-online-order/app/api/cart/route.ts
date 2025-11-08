import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/session";
import {
  addItemToCart,
  getActiveCartForUser,
  summarizeCartRecord,
} from "@/lib/cart/queries";
import { addToCartSchema } from "@/lib/cart/validation";

async function requireUser() {
  const session = await getSession();
  const userId = session?.session?.user?.id;

  if (!userId) {
    return null;
  }

  return { userId };
}

export async function GET() {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cart = await getActiveCartForUser(auth.userId);
  const summary = cart ? summarizeCartRecord(cart) : null;

  return NextResponse.json({ cart, summary });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      userId: auth.userId,
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
