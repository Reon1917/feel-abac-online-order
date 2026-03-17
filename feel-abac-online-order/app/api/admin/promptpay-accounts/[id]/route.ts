import { NextResponse, type NextRequest } from "next/server";

import { requirePromptPayAccess } from "@/lib/api/admin-guard";
import { deletePromptPayAccount } from "@/lib/payments/queries";

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
    const result = await deletePromptPayAccount(accountId);
    return NextResponse.json({
      account: result.deletedAccount,
      activeAccount: result.activeAccount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete account";
    const status = message === "Account not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
