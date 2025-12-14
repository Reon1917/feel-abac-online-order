# Moderator Role Implementation Plan

## Overview

Add a new "moderator" role for restaurant staff physically handling orders. Moderators have limited permissions compared to admins.

## Current State Analysis

### Existing Role System

```typescript
// src/db/schema.ts - admins table
role: text("role").notNull().default("admin") // "admin" | "super_admin"
```

### Current Permission Model
- **No granular permissions** - all admins have identical access
- `requireAdmin()` checks `isActive` only, not role type
- Middleware sets `isAdmin: boolean` with no role differentiation

## Role Hierarchy

```
super_admin > admin > moderator
```

| Permission | super_admin | admin | moderator |
|------------|:-----------:|:-----:|:---------:|
| Order Management | ✅ | ✅ | ✅ |
| Shop Open/Close | ✅ | ✅ | ✅ |
| Item Availability (in/out stock) | ✅ | ✅ | ✅ |
| Payment Verification | ✅ | ✅ | ✅ |
| Menu CRUD (items/categories/choices) | ✅ | ✅ | ❌ |
| Delivery Location Management | ✅ | ✅ | ❌ |
| PromptPay Account Management | ✅ | ✅ | ❌ |
| Admin User Management | ✅ | ❌ | ❌ |

## Implementation Plan

### 1. Schema Changes

No schema changes needed. The `role` column already accepts any text value.

```typescript
// Valid role values:
type AdminRole = "super_admin" | "admin" | "moderator";
```

### 2. New Types & Constants

**File: `lib/admin/types.ts`** (new)

```typescript
export const ADMIN_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  MODERATOR: "moderator",
} as const;

export type AdminRole = (typeof ADMIN_ROLES)[keyof typeof ADMIN_ROLES];

// Permission definitions
export const PERMISSIONS = {
  // Order operations
  ORDER_VIEW: "order:view",
  ORDER_ACCEPT: "order:accept",
  ORDER_CANCEL: "order:cancel",
  ORDER_HANDOFF: "order:handoff",
  ORDER_DELIVER: "order:deliver",
  ORDER_VERIFY_PAYMENT: "order:verify_payment",
  ORDER_REJECT_PAYMENT: "order:reject_payment",
  
  // Shop operations
  SHOP_TOGGLE: "shop:toggle",
  
  // Item availability
  ITEM_TOGGLE_STOCK: "item:toggle_stock",
  
  // Menu CRUD (admin+ only)
  MENU_CREATE: "menu:create",
  MENU_UPDATE: "menu:update",
  MENU_DELETE: "menu:delete",
  MENU_REORDER: "menu:reorder",
  
  // Admin management (super_admin only)
  ADMIN_ADD: "admin:add",
  ADMIN_REMOVE: "admin:remove",
  ADMIN_LIST: "admin:list",
  
  // Settings (admin+ only)
  DELIVERY_LOCATIONS: "settings:delivery_locations",
  PROMPTPAY_ACCOUNTS: "settings:promptpay_accounts",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Role to permissions mapping
export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  moderator: [
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_ACCEPT,
    PERMISSIONS.ORDER_CANCEL,
    PERMISSIONS.ORDER_HANDOFF,
    PERMISSIONS.ORDER_DELIVER,
    PERMISSIONS.ORDER_VERIFY_PAYMENT,
    PERMISSIONS.ORDER_REJECT_PAYMENT,
    PERMISSIONS.SHOP_TOGGLE,
    PERMISSIONS.ITEM_TOGGLE_STOCK,
  ],
  admin: [
    // All moderator permissions
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_ACCEPT,
    PERMISSIONS.ORDER_CANCEL,
    PERMISSIONS.ORDER_HANDOFF,
    PERMISSIONS.ORDER_DELIVER,
    PERMISSIONS.ORDER_VERIFY_PAYMENT,
    PERMISSIONS.ORDER_REJECT_PAYMENT,
    PERMISSIONS.SHOP_TOGGLE,
    PERMISSIONS.ITEM_TOGGLE_STOCK,
    // Plus menu CRUD
    PERMISSIONS.MENU_CREATE,
    PERMISSIONS.MENU_UPDATE,
    PERMISSIONS.MENU_DELETE,
    PERMISSIONS.MENU_REORDER,
    // Plus settings
    PERMISSIONS.DELIVERY_LOCATIONS,
    PERMISSIONS.PROMPTPAY_ACCOUNTS,
  ],
  super_admin: [
    // All permissions
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_ACCEPT,
    PERMISSIONS.ORDER_CANCEL,
    PERMISSIONS.ORDER_HANDOFF,
    PERMISSIONS.ORDER_DELIVER,
    PERMISSIONS.ORDER_VERIFY_PAYMENT,
    PERMISSIONS.ORDER_REJECT_PAYMENT,
    PERMISSIONS.SHOP_TOGGLE,
    PERMISSIONS.ITEM_TOGGLE_STOCK,
    PERMISSIONS.MENU_CREATE,
    PERMISSIONS.MENU_UPDATE,
    PERMISSIONS.MENU_DELETE,
    PERMISSIONS.MENU_REORDER,
    PERMISSIONS.DELIVERY_LOCATIONS,
    PERMISSIONS.PROMPTPAY_ACCOUNTS,
    PERMISSIONS.ADMIN_ADD,
    PERMISSIONS.ADMIN_REMOVE,
    PERMISSIONS.ADMIN_LIST,
  ],
};
```

### 3. Permission Checking Utilities

**File: `lib/admin/permissions.ts`** (new)

```typescript
import { ROLE_PERMISSIONS, type AdminRole, type Permission } from "./types";

export function hasPermission(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: AdminRole, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function hasAllPermissions(role: AdminRole, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

// Role hierarchy check
export function isRoleAtLeast(role: AdminRole, minimumRole: AdminRole): boolean {
  const hierarchy: AdminRole[] = ["moderator", "admin", "super_admin"];
  const roleIndex = hierarchy.indexOf(role);
  const minimumIndex = hierarchy.indexOf(minimumRole);
  return roleIndex >= minimumIndex;
}
```

### 4. Updated Admin Guard

**File: `lib/api/admin-guard.ts`** (modify)

```typescript
import { hasPermission, type Permission } from "@/lib/admin/types";

export async function requireAdminWithPermission(
  permission: Permission
): Promise<{ session: FeelSession; admin: AdminRow } | null> {
  const session = await getSession();
  const userId = session?.session?.user?.id;
  
  if (!userId) return null;
  
  const admin = await getAdminByUserId(userId);
  if (!admin?.isActive) return null;
  
  if (!hasPermission(admin.role as AdminRole, permission)) {
    return null;
  }
  
  return { session, admin };
}

// Convenience wrappers
export async function requireModeratorAccess() {
  return requireAdminWithPermission(PERMISSIONS.ORDER_VIEW);
}

export async function requireMenuEditAccess() {
  return requireAdminWithPermission(PERMISSIONS.MENU_UPDATE);
}

export async function requireSuperAdminAccess() {
  return requireAdminWithPermission(PERMISSIONS.ADMIN_ADD);
}
```

### 5. API Route Updates

#### Routes Moderators CAN Access (no changes needed):

| Route | Permission |
|-------|------------|
| `GET /api/admin/orders/*` | ORDER_VIEW |
| `PATCH /api/admin/orders/[displayId]/status` | ORDER_* |
| `POST /api/admin/orders/[displayId]/verify-payment` | ORDER_VERIFY_PAYMENT |
| `POST /api/admin/orders/[displayId]/reject-payment` | ORDER_REJECT_PAYMENT |
| `GET/POST /api/admin/settings/shop` | SHOP_TOGGLE |
| `PATCH /api/admin/menu/items/[itemId]` (availability only) | ITEM_TOGGLE_STOCK |

#### Routes Moderators CANNOT Access (add permission checks):

**Menu CRUD Routes** - add `requireAdminWithPermission(PERMISSIONS.MENU_CREATE)`:
- `POST /api/admin/menu/categories`
- `PUT/DELETE /api/admin/menu/categories/[categoryId]`
- `POST /api/admin/menu/items`
- `PUT/DELETE /api/admin/menu/items/[itemId]` (except `isAvailable` toggle)
- All `/api/admin/menu/choice-*` routes
- All `/api/admin/menu/pools/*` routes
- All `/api/admin/menu/recommended/*` routes
- `POST /api/admin/menu/images`
- `POST /api/admin/menu/reorder`

**Settings Routes** - add `requireAdminWithPermission(PERMISSIONS.DELIVERY_LOCATIONS)`:
- All `/api/admin/delivery-locations/*` routes
- All `/api/admin/promptpay-accounts/*` routes

**Admin Management Routes** - add `requireAdminWithPermission(PERMISSIONS.ADMIN_ADD)`:
- `POST /api/admin/add`
- `POST /api/admin/remove`
- `GET /api/admin/list`

### 6. Special Case: Item Availability Toggle

Moderators can only toggle `isAvailable` on items, not edit other fields.

**File: `app/api/admin/menu/items/[itemId]/route.ts`** (modify PUT handler)

```typescript
export async function PUT(request: NextRequest, { params }) {
  const { admin } = await requireActiveAdmin();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 403 });
  
  const payload = await request.json();
  
  // Moderator restriction: only allow isAvailable toggle
  if (admin.role === "moderator") {
    const allowedFields = ["isAvailable"];
    const payloadKeys = Object.keys(payload);
    const hasDisallowedFields = payloadKeys.some(k => !allowedFields.includes(k));
    
    if (hasDisallowedFields) {
      return Response.json(
        { error: "Moderators can only toggle item availability" },
        { status: 403 }
      );
    }
  }
  
  // ... rest of existing logic
}
```

### 7. Middleware Updates

**File: `proxy.ts`** (modify)

```typescript
// Add role to session payload
const admin = await getAdminByUserId(session.user.id);
const isAdmin = !!admin?.isActive;
const adminRole = admin?.role ?? null;

// Update x-feel-session payload
const payload = {
  session,
  onboarded,
  isAdmin,
  adminRole, // NEW: include role
};
```

**File: `lib/session.ts`** (modify)

```typescript
export type FeelSession = {
  session: { user: { id: string; email: string; name: string } };
  onboarded: boolean;
  isAdmin?: boolean;
  adminRole?: "super_admin" | "admin" | "moderator" | null; // NEW
};
```

### 8. Frontend Updates

#### Admin Sidebar Navigation

Hide menu sections based on role:

```typescript
// components/admin/admin-sidebar.tsx
const { adminRole } = useSession();
const canEditMenu = adminRole !== "moderator";
const canManageAdmins = adminRole === "super_admin";

return (
  <nav>
    <Link href="/admin/orders">Orders</Link>
    <Link href="/admin/settings/shop">Shop Status</Link>
    {canEditMenu && (
      <>
        <Link href="/admin/menu">Menu Editor</Link>
        <Link href="/admin/delivery">Delivery Locations</Link>
        <Link href="/admin/promptpay">Payment Settings</Link>
      </>
    )}
    {canManageAdmins && (
      <Link href="/admin/users">Admin Users</Link>
    )}
  </nav>
);
```

#### Moderator-Specific Dashboard

Create simplified dashboard for moderators:

```typescript
// app/[lang]/admin/dashboard/page.tsx
const role = sessionData.adminRole;

if (role === "moderator") {
  return <ModeratorDashboard />;
}

return <AdminDashboard />;
```

**Moderator Dashboard includes:**
- Active orders list
- Quick shop open/close toggle
- Item stock status toggles
- No menu editing links

### 9. New API Endpoint: Item Availability Toggle

Create dedicated endpoint for moderators to toggle item stock status:

**File: `app/api/admin/menu/items/[itemId]/availability/route.ts`** (new)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import { hasPermission, PERMISSIONS } from "@/lib/admin/types";
import { db } from "@/src/db/client";
import { menuItems } from "@/src/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { admin } = await requireActiveAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  
  if (!hasPermission(admin.role, PERMISSIONS.ITEM_TOGGLE_STOCK)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  
  const { itemId } = await params;
  const { isAvailable } = await request.json();
  
  if (typeof isAvailable !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  
  const [updated] = await db
    .update(menuItems)
    .set({ isAvailable })
    .where(eq(menuItems.id, itemId))
    .returning();
  
  if (!updated) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  
  return NextResponse.json({ item: updated });
}
```

## Database Seed Script Update

**File: `scripts/seed-moderator.ts`** (new)

```typescript
import { db } from "@/src/db/client";
import { admins, users } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";

const MODERATOR_EMAIL = process.env.MODERATOR_EMAIL || "moderator@feelabac.com";

async function seedModerator() {
  console.log("🔍 Looking for user:", MODERATOR_EMAIL);
  
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, MODERATOR_EMAIL))
    .limit(1);
  
  if (!user) {
    console.error("❌ User not found. Create account first.");
    process.exit(1);
  }
  
  const [existing] = await db
    .select()
    .from(admins)
    .where(eq(admins.userId, user.id))
    .limit(1);
  
  if (existing) {
    console.log("✅ User is already an admin with role:", existing.role);
    process.exit(0);
  }
  
  await db.insert(admins).values({
    id: crypto.randomUUID(),
    userId: user.id,
    email: user.email,
    name: user.name,
    role: "moderator",
    isActive: true,
  });
  
  console.log("✅ Created moderator:", user.email);
}

seedModerator().catch(console.error);
```

## Implementation Order

### Phase 1: Foundation (Day 1)
1. Create `lib/admin/types.ts` with roles and permissions
2. Create `lib/admin/permissions.ts` with utility functions
3. Update `lib/session.ts` to include `adminRole`
4. Update `proxy.ts` to pass role in session payload

### Phase 2: API Protection (Day 2)
1. Create `requireAdminWithPermission()` guard
2. Update menu CRUD routes with permission checks
3. Update settings routes with permission checks
4. Update admin management routes with permission checks
5. Create `/availability` endpoint for item stock toggle

### Phase 3: Frontend (Day 3)
1. Update admin sidebar to hide sections based on role
2. Create ModeratorDashboard component
3. Add item availability toggle UI for moderators
4. Update shop status toggle to work for moderators

### Phase 4: Testing & Polish
1. Create seed script for moderators
2. Test all permission boundaries
3. Update documentation

## Testing Checklist

### Moderator CAN:
- [ ] View order list
- [ ] Accept orders
- [ ] Cancel orders (with reason)
- [ ] Mark orders as handed off
- [ ] Mark orders as delivered
- [ ] Verify payment receipts
- [ ] Reject payment receipts
- [ ] Toggle shop open/close
- [ ] Toggle item availability (in stock / out of stock)

### Moderator CANNOT:
- [ ] Create/edit/delete menu categories
- [ ] Create/edit/delete menu items (except availability)
- [ ] Create/edit/delete choice groups/options
- [ ] Manage choice pools
- [ ] Manage recommended items
- [ ] Upload menu images
- [ ] Reorder menu items
- [ ] Manage delivery locations
- [ ] Manage PromptPay accounts
- [ ] Add/remove admins
- [ ] View admin list

### Access Denial Behavior:
- [ ] API returns 403 Forbidden
- [ ] UI hides inaccessible navigation items
- [ ] Direct URL access to restricted pages redirects to dashboard

## Security Considerations

1. **Server-side enforcement**: All permission checks happen on server, never trust client
2. **Role validation**: Validate role is valid enum value before checking permissions
3. **Audit logging**: Log moderator actions in `orderEvents` with proper `actorType`
4. **Session invalidation**: If role changes, user must re-login for new permissions

## Rollback Plan

If issues arise:
1. All moderator records can be updated to "admin" role
2. Permission guards fall through to existing `requireAdmin` behavior
3. No schema changes means no migration rollback needed

## Future Enhancements

1. **Custom permissions**: Allow per-user permission overrides
2. **Action audit log**: Track all moderator actions for accountability
3. **Time-based access**: Limit moderator access to working hours
4. **Multi-restaurant**: Moderators scoped to specific restaurant location
