export type CartItemChoice = {
  id: string;
  cartItemId: string;
  groupName: string;
  groupNameMm: string | null;
  optionName: string;
  optionNameMm: string | null;
  extraPrice: number;
  // Set menu specific fields
  selectionRole: "base" | "addon" | null;
  menuCode: string | null;
};

export type CartItemRecord = {
  id: string;
  cartId: string;
  menuItemId: string;
  menuItemName: string;
  menuItemNameMm: string | null;
  basePrice: number;
  addonsTotal: number;
  quantity: number;
  note: string | null;
  totalPrice: number;
  hashKey: string;
  createdAt: Date;
  updatedAt: Date;
  choices: CartItemChoice[];
};

export type CartRecord = {
  id: string;
  userId: string | null;
  sessionToken: string | null;
  status: string;
  subtotal: number;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
  items: CartItemRecord[];
};

export type CartSummary = {
  id: string;
  subtotal: number;
  itemCount: number;
  totalQuantity: number;
};

export type AddToCartSelection = {
  groupId: string;
  optionIds: string[];
};

export type AddToCartInput = {
  userId: string;
  menuItemId: string;
  quantity: number;
  note?: string | null;
  selections: AddToCartSelection[];
};

export const MAX_QUANTITY_PER_LINE = 20;

export type UpdateCartItemInput = {
  userId: string;
  cartItemId: string;
  quantity: number;
};

export type RemoveCartItemInput = {
  userId: string;
  cartItemId: string;
};

// ===== SET MENU TYPES =====

export type SetMenuSelection = {
  poolLinkId: string;
  optionId: string;
};

export type AddSetMenuToCartInput = {
  userId: string;
  menuItemId: string; // The set menu item
  quantity: number;
  note?: string | null;
  selections: SetMenuSelection[];
};

export type SetMenuCartItemData = {
  menuItemId: string;
  menuItemName: string;
  menuItemNameMm: string | null;
  basePrice: number; // From base_curry selection
  addonsTotal: number; // Sum of addon selections
  totalPrice: number;
  selections: SetMenuSelection[];
};
