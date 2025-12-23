import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { requireActiveAdmin } from "@/lib/api/admin-guard";

const SOUND_FILES: Record<string, URL> = {
  order: new URL("../../../../../assets/sounds/order.mp3", import.meta.url),
  payment: new URL("../../../../../assets/sounds/payment.mp3", import.meta.url),
};

export const runtime = "nodejs";

type RouteParams = {
  sound: string;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<RouteParams> }
) {
  const admin = await requireActiveAdmin();
  if (!admin) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { sound } = await params;
  const fileUrl = SOUND_FILES[sound];
  if (!fileUrl) {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    const filePath = fileURLToPath(fileUrl);
    const file = await readFile(filePath);
    return new NextResponse(file, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}
