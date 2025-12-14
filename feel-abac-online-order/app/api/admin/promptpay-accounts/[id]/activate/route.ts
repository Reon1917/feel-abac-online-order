import { NextResponse, type NextRequest } from "next/server";
import { requirePromptPayAccess } from "@/lib/api/admin-guard";
import { activatePromptPayAccount } from "@/lib/payments/queries";

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

  const result = await requirePromptPayAccess();
  if (!result) {
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
