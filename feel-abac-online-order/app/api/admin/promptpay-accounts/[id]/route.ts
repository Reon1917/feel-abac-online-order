import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { requirePromptPayAccess } from "@/lib/api/admin-guard";
import { db } from "@/src/db/client";
import { promptpayAccounts } from "@/src/db/schema";

type Params = {
  id: string;
};

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const resolvedParams = await params;
  const accountId = resolvedParams.id?.trim();

  if (!accountId) {
    return NextResponse.json({ error: "Missing account ID" }, { status: 400 });
  }

  const result = await requirePromptPayAccess();
  if (!result) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [account] = await db
      .delete(promptpayAccounts)
      .where(eq(promptpayAccounts.id, accountId))
      .returning();

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    return NextResponse.json({ account });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete account";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
