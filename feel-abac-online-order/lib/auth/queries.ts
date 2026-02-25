import { db } from "@/src/db/client";
import { accounts, users } from "@/src/db/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Check if a user has a credential (email/password) account.
 * Users who signed up with Google only won't have a credential account.
 */
export async function hasCredentialAccount(userId: string): Promise<boolean> {
  const credentialAccount = await db.query.accounts.findFirst({
    where: and(
      eq(accounts.userId, userId),
      eq(accounts.providerId, "credential")
    ),
  });
  return !!credentialAccount;
}

/**
 * Get all linked provider IDs for a user (e.g., "credential", "google")
 */
export async function getLinkedProviders(userId: string): Promise<string[]> {
  const userAccounts = await db
    .select({ providerId: accounts.providerId })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  return userAccounts.map((a) => a.providerId);
}

/**
 * Check if a given email already has a credential (email/password) account.
 */
export async function hasCredentialAccountByEmail(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .innerJoin(users, eq(users.id, accounts.userId))
    .where(
      and(
        eq(accounts.providerId, "credential"),
        sql`lower(${users.email}) = ${normalized}`
      )
    )
    .limit(1);

  return !!row;
}

/**
 * Get linked provider IDs for a user resolved by email.
 */
export async function getLinkedProvidersByEmail(email: string): Promise<string[]> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return [];

  const userAccounts = await db
    .select({ providerId: accounts.providerId })
    .from(accounts)
    .innerJoin(users, eq(users.id, accounts.userId))
    .where(sql`lower(${users.email}) = ${normalized}`);

  return userAccounts.map((account) => account.providerId);
}
