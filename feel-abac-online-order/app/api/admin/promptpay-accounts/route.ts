import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { resolveUserId } from "@/lib/api/require-user";
import {
  createPromptPayAccount,
  listPromptPayAccounts,
} from "@/lib/payments/queries";
import { db } from "@/src/db/client";
import { admins } from "@/src/db/schema";
import { normalizePromptPayPhone } from "@/lib/payments/promptpay";

export async function GET(req: NextRequest) {
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

  const accounts = await listPromptPayAccounts();
  return NextResponse.json({ accounts });
}

const createAccountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phoneNumber: z.string().min(8, "Phone number is required"),
  activate: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
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
