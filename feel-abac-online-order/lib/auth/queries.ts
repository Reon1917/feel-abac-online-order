import { db } from "@/src/db/client";
import { accounts } from "@/src/db/schema";
import { eq, and } from "drizzle-orm";

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
