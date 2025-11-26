import { desc, eq } from "drizzle-orm";

import { db } from "@/src/db/client";
import { promptpayAccounts } from "@/src/db/schema";
import { normalizePromptPayPhone } from "./promptpay";

export type PromptPayAccountRecord = {
  id: string;
  name: string;
  phoneNumber: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function mapPromptPayAccount(
  row: typeof promptpayAccounts.$inferSelect
): PromptPayAccountRecord {
  return {
    id: row.id,
    name: row.name,
    phoneNumber: row.phoneNumber,
    isActive: row.isActive ?? false,
    createdAt: row.createdAt?.toISOString() ?? "",
    updatedAt: row.updatedAt?.toISOString() ?? "",
  };
}

export async function listPromptPayAccounts(): Promise<PromptPayAccountRecord[]> {
  const rows = await db
    .select()
    .from(promptpayAccounts)
    .orderBy(desc(promptpayAccounts.isActive), desc(promptpayAccounts.createdAt));

  return rows.map((row) => mapPromptPayAccount(row));
}

export async function getActivePromptPayAccount(): Promise<PromptPayAccountRecord | null> {
  const [row] = await db
    .select()
    .from(promptpayAccounts)
    .where(eq(promptpayAccounts.isActive, true))
    .orderBy(desc(promptpayAccounts.updatedAt))
    .limit(1);

  return row ? mapPromptPayAccount(row) : null;
}

export async function createPromptPayAccount(input: {
  name: string;
  phoneNumber: string;
  activate?: boolean;
}): Promise<PromptPayAccountRecord> {
  const normalizedPhone = normalizePromptPayPhone(input.phoneNumber);
  if (!normalizedPhone) {
    throw new Error("Invalid PromptPay phone number");
  }

  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error("Account name is required");
  }

  const [existingActive] = await db
    .select({ id: promptpayAccounts.id })
    .from(promptpayAccounts)
    .where(eq(promptpayAccounts.isActive, true))
    .limit(1);

  const shouldActivate = Boolean(input.activate) || !existingActive;

  if (shouldActivate) {
    await db.update(promptpayAccounts).set({ isActive: false });
  }

  const [inserted] = await db
    .insert(promptpayAccounts)
    .values({
      name: trimmedName,
      phoneNumber: normalizedPhone,
      isActive: shouldActivate,
    })
    .returning();

  return mapPromptPayAccount(inserted);
}

export async function activatePromptPayAccount(accountId: string): Promise<PromptPayAccountRecord> {
  const trimmedId = accountId.trim();
  if (!trimmedId) {
    throw new Error("Account ID is required");
  }

  const [existing] = await db
    .select()
    .from(promptpayAccounts)
    .where(eq(promptpayAccounts.id, trimmedId))
    .limit(1);

  if (!existing) {
    throw new Error("Account not found");
  }

  await db.update(promptpayAccounts).set({ isActive: false });

  const [activated] = await db
    .update(promptpayAccounts)
    .set({ isActive: true })
    .where(eq(promptpayAccounts.id, trimmedId))
    .returning();

  return mapPromptPayAccount(activated);
}
