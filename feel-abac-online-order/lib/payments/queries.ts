import { desc, eq } from "drizzle-orm";

import { db } from "@/src/db/client";
import { promptpayAccounts } from "@/src/db/schema";
import { normalizePromptPayPhone } from "./promptpay";

export type PromptPayAccountRecord = {
  id: string;
  name: string;
  accountType: string;
  phoneNumber: string | null;
  billerId: string | null;
  ref1: string | null;
  ref2: string | null;
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
    accountType: row.accountType ?? "anyid",
    phoneNumber: row.phoneNumber ?? null,
    billerId: row.billerId ?? null,
    ref1: row.ref1 ?? null,
    ref2: row.ref2 ?? null,
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

export type CreatePromptPayAccountInput =
  | {
      accountType: "anyid";
      name: string;
      phoneNumber: string;
      activate?: boolean;
    }
  | {
      accountType: "billpayment";
      name: string;
      billerId: string;
      ref1: string;
      ref2?: string;
      activate?: boolean;
    };

export async function createPromptPayAccount(
  input: CreatePromptPayAccountInput,
): Promise<PromptPayAccountRecord> {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error("Account name is required");
  }

  let normalizedPhone: string | null = null;

  if (input.accountType === "anyid") {
    normalizedPhone = normalizePromptPayPhone(input.phoneNumber);
    if (!normalizedPhone) {
      throw new Error("Invalid PromptPay phone number");
    }
  } else {
    if (!input.billerId.trim()) throw new Error("Biller ID is required");
    if (!input.ref1.trim()) throw new Error("Reference 1 is required");
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

  const values =
    input.accountType === "billpayment"
      ? {
          name: trimmedName,
          accountType: "billpayment" as const,
          billerId: input.billerId.trim(),
          ref1: input.ref1.trim(),
          ref2: input.ref2?.trim() || null,
          isActive: shouldActivate,
        }
      : {
          name: trimmedName,
          accountType: "anyid" as const,
          phoneNumber: normalizedPhone,
          isActive: shouldActivate,
        };

  const [inserted] = await db
    .insert(promptpayAccounts)
    .values(values)
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
