import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getAdminByUserId } from "@/lib/admin";
import type { FeelSession } from "@/lib/session";
import { hasPermission, isValidAdminRole } from "@/lib/admin/permissions";
import { PERMISSIONS, type AdminRole, type Permission } from "@/lib/admin/types";

export type AdminRecord = {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: AdminRole;
  isActive: boolean;
};

export type AdminGuardResult = {
  session: FeelSession;
  admin: AdminRecord;
};

async function resolveSessionAndAdmin(): Promise<{
  session: FeelSession | null;
  admin: AdminRecord | null;
}> {
  const headerList = await headers();
  const authSession = await auth.api.getSession({
    headers: headerList,
    asResponse: false,
    returnHeaders: false,
  });

  if (!authSession?.user) {
    return { session: null, admin: null };
  }

  const session: FeelSession = {
    session: {
      user: {
        id: authSession.user.id,
        email: authSession.user.email ?? "",
        name: authSession.user.name ?? "",
      },
    },
    onboarded: true,
    isAdmin: true,
    adminRole: null,
  };

  const userId = authSession.user.id;

  const adminRecord = await getAdminByUserId(userId);
  if (!adminRecord?.isActive) {
    return { session, admin: null };
  }

  if (!isValidAdminRole(adminRecord.role)) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[admin-guard] invalid admin role in DB", {
        userId: adminRecord.userId,
        role: adminRecord.role,
      });
    }
    return { session, admin: null };
  }

  const role: AdminRole = adminRecord.role;

  const admin: AdminRecord = {
    id: adminRecord.id,
    userId: adminRecord.userId,
    email: adminRecord.email,
    name: adminRecord.name,
    role,
    isActive: adminRecord.isActive,
  };

  const resolvedSession: FeelSession = {
    ...session!,
    isAdmin: true,
    adminRole: role,
  };

  return { session: resolvedSession, admin };
}

/**
 * Require an active admin with a specific permission.
 * Returns null if user is not an admin or lacks the required permission.
 */
export async function requireAdminWithPermission(
  permission: Permission
): Promise<AdminGuardResult | null> {
  const { session, admin } = await resolveSessionAndAdmin();

  if (!session || !admin) {
    return null;
  }

  if (!hasPermission(admin.role, permission)) {
    return null;
  }

  return { session, admin };
}

/**
 * Require any active admin (any role).
 * Use this for read-only operations accessible to all admin roles.
 */
export async function requireActiveAdmin(): Promise<AdminGuardResult | null> {
  const { session, admin } = await resolveSessionAndAdmin();

  if (!session || !admin) {
    return null;
  }

  return { session, admin };
}

/**
 * Require an admin with menu editing permissions.
 * Moderators cannot edit menus.
 */
export async function requireMenuAccess(): Promise<AdminGuardResult | null> {
  return requireAdminWithPermission(PERMISSIONS.MENU_UPDATE);
}

/**
 * Require a super_admin.
 * Only super_admins can manage other admins.
 */
export async function requireSuperAdmin(): Promise<AdminGuardResult | null> {
  return requireAdminWithPermission(PERMISSIONS.ADMIN_ADD);
}

/**
 * Require admin with delivery locations management permission.
 * Moderators cannot manage delivery locations.
 */
export async function requireDeliveryLocationsAccess(): Promise<AdminGuardResult | null> {
  return requireAdminWithPermission(PERMISSIONS.DELIVERY_LOCATIONS);
}

/**
 * Require admin with PromptPay accounts management permission.
 * Moderators cannot manage PromptPay accounts.
 */
export async function requirePromptPayAccess(): Promise<AdminGuardResult | null> {
  return requireAdminWithPermission(PERMISSIONS.PROMPTPAY_ACCOUNTS);
}

// Re-export for convenience
export { PERMISSIONS };
