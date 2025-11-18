import { NextResponse } from "next/server";
import { getPublicMenuHierarchy } from "@/lib/menu/queries";
import { getPublicRecommendedMenuItems } from "@/lib/menu/recommendations";

export const revalidate = 300; // 5 minutes

const CACHE_HEADER =
  "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

export async function GET() {
  const [menu, recommended] = await Promise.all([
    getPublicMenuHierarchy(),
    getPublicRecommendedMenuItems(),
  ]);

  return NextResponse.json(
    { menu, recommended },
    {
      headers: {
        "Cache-Control": CACHE_HEADER,
      },
    }
  );
}
