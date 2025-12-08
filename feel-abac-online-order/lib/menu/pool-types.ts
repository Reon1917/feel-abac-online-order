export const SET_MENU_POOL_ROLES = [
  "base_curry",
  "addon_curry",
  "addon_veggie",
] as const;

export type SetMenuPoolRole = (typeof SET_MENU_POOL_ROLES)[number];

export type ChoicePoolOption = {
  id: string;
  poolId: string;
  menuCode: string | null;
  nameEn: string;
  nameMm: string | null;
  price: number;
  isAvailable: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ChoicePool = {
  id: string;
  nameEn: string;
  nameMm: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ChoicePoolWithOptions = ChoicePool & {
  options: ChoicePoolOption[];
};

export type SetMenuPoolLink = {
  id: string;
  menuItemId: string;
  poolId: string;
  role: string;
  isPriceDetermining: boolean;
  usesOptionPrice: boolean;
  flatPrice: number | null;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  labelEn: string | null;
  labelMm: string | null;
  displayOrder: number;
  createdAt: Date;
};

export type SetMenuPoolLinkWithPool = SetMenuPoolLink & {
  pool: ChoicePoolWithOptions;
};

