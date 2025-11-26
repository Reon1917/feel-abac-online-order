import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { resolveUserId } from "@/lib/api/require-user";
import { activatePromptPayAccount } from "@/lib/payments/queries";
import { db } from "@/src/db/client";
import { admins } from "@/src/db/schema";

type Params = {
  id: string;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const resolvedParams = await params;
  const accountId = resolvedParams.id?.trim();

  if (!accountId) {
    return NextResponse.json({ error: "Missing account ID" }, { status: 400 });
  }

  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminRow =
    (await db
      .select({ id: admins.id })
      .from(admins)
      .where(eq(admins.userId, userId))
      .limit(1))[0] ?? null;

  if (!adminRow) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const account = await activatePromptPayAccount(accountId);
    return NextResponse.json({ account });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to activate account";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
