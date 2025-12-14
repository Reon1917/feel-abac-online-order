import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  requirePromptPayAccess,
} from "@/lib/api/admin-guard";
import {
  createPromptPayAccount,
  listPromptPayAccounts,
} from "@/lib/payments/queries";
import { normalizePromptPayPhone } from "@/lib/payments/promptpay";

export async function GET() {
  const result = await requirePromptPayAccess();
  if (!result) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const accounts = await listPromptPayAccounts();
    return NextResponse.json({ accounts });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Failed to list PromptPay accounts:", error);
    }
    return NextResponse.json(
      { error: "Failed to retrieve accounts" },
      { status: 500 }
    );
  }
}

const createAccountSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  phoneNumber: z.string().trim().min(8, "Phone number is required"),
  activate: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const result = await requirePromptPayAccess();
  if (!result) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as unknown;
  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const normalizedPhone = normalizePromptPayPhone(parsed.data.phoneNumber);
  if (!normalizedPhone) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

  try {
    const account = await createPromptPayAccount({
      name: parsed.data.name.trim(),
      phoneNumber: normalizedPhone,
      activate: parsed.data.activate,
    });

    return NextResponse.json({ account });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create account";
    const knownClientError =
      message.toLowerCase().includes("invalid") ||
      message.toLowerCase().includes("required") ||
      message.toLowerCase().includes("duplicate") ||
      message.toLowerCase().includes("unique");

    if (knownClientError) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (process.env.NODE_ENV !== "production") {
      console.error("[promptpay-accounts] failed to create account", {
        error,
        requesterUserId: result.admin.userId,
      });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
