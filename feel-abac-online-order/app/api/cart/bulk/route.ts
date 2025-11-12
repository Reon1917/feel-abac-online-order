import { NextRequest } from "next/server";
import { z } from "zod";

import { resolveUserId } from "@/lib/api/require-user";
import { addItemsToCart } from "@/lib/cart/queries";
import { MAX_QUANTITY_PER_LINE } from "@/lib/cart/types";

const payloadSchema = z.object({
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_LINE),
      })
    )
    .min(1),
});

export async function POST(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const queue = parsed.data.items;

  try {
    const summary = await addItemsToCart(
      queue.map((item) => ({
        userId,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        selections: [],
      }))
    );

    return Response.json({ ok: true, summary });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to add these items.";
    return Response.json({ error: message }, { status: 400 });
  }
}
