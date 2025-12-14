export const ADMIN_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  MODERATOR: "moderator",
} as const;

export type AdminRole = (typeof ADMIN_ROLES)[keyof typeof ADMIN_ROLES];

// Granular permission definitions
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

// Moderator permissions - restaurant staff handling orders
const MODERATOR_PERMISSIONS: Permission[] = [
  PERMISSIONS.ORDER_VIEW,
  PERMISSIONS.ORDER_ACCEPT,
  PERMISSIONS.ORDER_CANCEL,
  PERMISSIONS.ORDER_HANDOFF,
  PERMISSIONS.ORDER_DELIVER,
  PERMISSIONS.ORDER_VERIFY_PAYMENT,
  PERMISSIONS.ORDER_REJECT_PAYMENT,
  PERMISSIONS.SHOP_TOGGLE,
  PERMISSIONS.ITEM_TOGGLE_STOCK,
];

// Admin permissions - moderator + menu CRUD + settings
const ADMIN_PERMISSIONS: Permission[] = [
  ...MODERATOR_PERMISSIONS,
  PERMISSIONS.MENU_CREATE,
  PERMISSIONS.MENU_UPDATE,
  PERMISSIONS.MENU_DELETE,
  PERMISSIONS.MENU_REORDER,
  PERMISSIONS.DELIVERY_LOCATIONS,
  PERMISSIONS.PROMPTPAY_ACCOUNTS,
];

// Super admin permissions - all permissions
const SUPER_ADMIN_PERMISSIONS: Permission[] = [
  ...ADMIN_PERMISSIONS,
  PERMISSIONS.ADMIN_ADD,
  PERMISSIONS.ADMIN_REMOVE,
  PERMISSIONS.ADMIN_LIST,
];

// Role to permissions mapping
export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  moderator: MODERATOR_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
  super_admin: SUPER_ADMIN_PERMISSIONS,
};
