import { NextRequest, NextResponse } from "next/server";

import { requireActiveAdmin } from "@/lib/api/admin-guard";
import { createDeliveryLocation } from "@/lib/delivery/mutations";
import { createDeliveryLocationSchema } from "@/lib/delivery/validation";

export async function POST(request: NextRequest) {
  const session = await requireActiveAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const parsed = createDeliveryLocationSchema.safeParse({
      condoName: body.condoName,
      minFee: Number(body.minFee),
      maxFee: Number(body.maxFee),
      notes: body.notes,
      buildings: Array.isArray(body.buildings)
        ? body.buildings
            .map((label: unknown) =>
              typeof label === "string" ? label.trim() : ""
            )
            .filter((label: string) => label.length > 0)
        : [],
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
        { status: 400 }
      );
    }

    const location = await createDeliveryLocation(parsed.data);

    return NextResponse.json({ location });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Failed to create delivery location", error);
    }
    return NextResponse.json(
      { error: "Failed to create delivery location" },
      { status: 500 }
    );
  }
}
