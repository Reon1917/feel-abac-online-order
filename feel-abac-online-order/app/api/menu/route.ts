import { NextResponse } from "next/server";
import { getPublicMenuHierarchy } from "@/lib/menu/queries";

export const revalidate = 0;

const CACHE_HEADER =
  "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

export async function GET() {
  const menu = await getPublicMenuHierarchy();

  return NextResponse.json(
    { menu },
    {
      headers: {
        "Cache-Control": CACHE_HEADER,
      },
    }
  );
}
