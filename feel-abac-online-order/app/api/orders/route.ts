import { NextResponse, type NextRequest } from "next/server";

import {
  createOrderFromCart,
  isOrderItemsUnavailableError,
} from "@/lib/orders/create";
import { isActiveOrderBlockError } from "@/lib/orders/active-order";
import type { DeliverySelection } from "@/lib/delivery/types";
import { resolveUserId } from "@/lib/api/require-user";
import { getShopStatus } from "@/lib/shop/queries";

type CreateOrderBody = {
  deliverySelection?: DeliverySelection | null;
};

function validateDeliverySelection(selection: DeliverySelection | null) {
  if (!selection) {
    throw new Error("Delivery selection is required");
  }

  if (selection.mode === "preset") {
    if (!selection.locationId) {
      throw new Error("Delivery location is required");
    }
    return;
  }

  if (!selection.customCondoName || selection.customCondoName.trim().length === 0) {
    throw new Error("Custom condo name is required");
  }
}

export async function POST(req: NextRequest) {
  const userId = await resolveUserId(req);

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

  const body = (await req.json().catch(() => null)) as CreateOrderBody | null;
  const deliverySelection = body?.deliverySelection ?? null;

  try {
    validateDeliverySelection(deliverySelection);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid delivery selection";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const result = await createOrderFromCart({
      userId,
      deliverySelection: deliverySelection as DeliverySelection,
    });

    return NextResponse.json({ order: result });
  } catch (error) {
    if (isActiveOrderBlockError(error)) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          activeOrder: {
            displayId: error.activeOrder.displayId,
            status: error.activeOrder.status,
          },
        },
        { status: 409 }
      );
    }
    if (isOrderItemsUnavailableError(error)) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          unavailableItems: error.unavailableItems,
        },
        { status: 409 }
      );
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[api/orders] failed to create order", error);
    }
    const message = error instanceof Error ? error.message : "Unable to create order";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
