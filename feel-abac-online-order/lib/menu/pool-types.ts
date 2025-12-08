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

