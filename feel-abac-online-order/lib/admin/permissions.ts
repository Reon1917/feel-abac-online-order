import {
  ROLE_PERMISSIONS,
  type AdminRole,
  type Permission,
} from "./types";

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(
  role: AdminRole,
  permissions: Permission[]
): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(
  role: AdminRole,
  permissions: Permission[]
): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

/**
 * Role hierarchy check - returns true if role is at or above the minimum required role
 */
export function isRoleAtLeast(role: AdminRole, minimumRole: AdminRole): boolean {
  const hierarchy: AdminRole[] = ["moderator", "admin", "super_admin"];
  const roleIndex = hierarchy.indexOf(role);
  const minimumIndex = hierarchy.indexOf(minimumRole);
  return roleIndex >= minimumIndex;
}

/**
 * Check if a role string is a valid AdminRole
 */
export function isValidAdminRole(role: string): role is AdminRole {
  return role === "super_admin" || role === "admin" || role === "moderator";
}
