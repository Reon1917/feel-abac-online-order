import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { resolveUserId } from "@/lib/api/require-user";
import {
  createPromptPayAccount,
  listPromptPayAccounts,
} from "@/lib/payments/queries";
import { normalizePromptPayPhone } from "@/lib/payments/promptpay";
import { requireAdmin } from "@/lib/api/require-admin";

export async function GET(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminRow = await requireAdmin(userId);
  if (!adminRow) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const accounts = await listPromptPayAccounts();
    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("Failed to list PromptPay accounts:", error);
    return NextResponse.json(
      { error: "Failed to retrieve accounts" },
      { status: 500 }
    );
  }
}

const createAccountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phoneNumber: z.string().min(8, "Phone number is required"),
  activate: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminRow = await requireAdmin(userId);
  if (!adminRow) {
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
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
