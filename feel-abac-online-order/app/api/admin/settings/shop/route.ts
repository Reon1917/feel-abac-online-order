import { NextResponse, type NextRequest } from "next/server";

import { resolveUserId } from "@/lib/api/require-user";
import { requireAdmin } from "@/lib/api/require-admin";
import { getShopStatus, setShopStatus } from "@/lib/shop/queries";

function normalizeMessage(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET() {
  const status = await getShopStatus();
  return NextResponse.json(status);
}

export async function POST(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminRow = await requireAdmin(userId);
  if (!adminRow) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        isOpen?: unknown;
        closedMessageEn?: unknown;
        closedMessageMm?: unknown;
      }
    | null;

  if (!body || typeof body.isOpen !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const messageEn = normalizeMessage(body.closedMessageEn);
  const messageMm = normalizeMessage(body.closedMessageMm);

  await setShopStatus(body.isOpen, adminRow.id, messageEn ?? undefined, messageMm ?? undefined);

  const status = await getShopStatus();
  return NextResponse.json(status);
}
