import { NextResponse } from "next/server";
import { getPublicMenuItemById } from "@/lib/menu/queries";

export const revalidate = 300;

const CACHE_HEADER =
  "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

type RouteContext = {
  params: {
    itemId: string;
  };
};

export async function GET(_request: Request, context: RouteContext) {
  const rawItemId = context.params?.itemId ?? "";
  const normalizedId = rawItemId.trim();

  if (!normalizedId) {
    return NextResponse.json(
      { error: "Invalid menu item id." },
      { status: 400 }
    );
  }

  const detail = await getPublicMenuItemById(normalizedId);
  if (!detail) {
    return NextResponse.json(
      { error: "Menu item not found." },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { detail },
    {
      headers: {
        "Cache-Control": CACHE_HEADER,
      },
    }
  );
}

