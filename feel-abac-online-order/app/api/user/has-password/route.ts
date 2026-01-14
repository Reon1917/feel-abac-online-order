import { NextRequest, NextResponse } from "next/server";
import { resolveUserId } from "@/lib/api/require-user";
import { hasCredentialAccount } from "@/lib/auth/queries";

export async function GET(request: NextRequest) {
  const userId = await resolveUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hasPassword = await hasCredentialAccount(userId);

  return NextResponse.json({ hasPassword });
}
