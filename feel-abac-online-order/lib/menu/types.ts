export type MenuChoiceOption = {
  id: string;
  choiceGroupId: string;
  nameEn: string;
  nameMm: string | null;
  extraPrice: number;
  isAvailable: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type MenuChoiceGroupType =
  | "single"
  | "multi"
  | "toggle"
  | "dropdown"
  | "quantity";

export type MenuChoiceGroup = {
  id: string;
  menuItemId: string;
  titleEn: string;
  titleMm: string | null;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  type: MenuChoiceGroupType;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
  options: MenuChoiceOption[];
};

export type MenuItemStatus = "draft" | "published";

export type SetMenuPoolLinkRecord = {
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
  pool: {
    id: string;
    nameEn: string;
    nameMm: string | null;
    isActive: boolean;
    displayOrder: number;
    options: {
      id: string;
      poolId: string;
      menuCode: string | null;
      nameEn: string;
      nameMm: string | null;
      price: number;
      isAvailable: boolean;
      displayOrder: number;
    }[];
  };
};

export type MenuItemRecord = {
  id: string;
  categoryId: string;
  nameEn: string;
  nameMm: string | null;
  price: number;
  imageUrl: string | null;
  hasImage: boolean;
  placeholderIcon: string | null;
  menuCode: string | null;
  descriptionEn: string | null;
  descriptionMm: string | null;
  isAvailable: boolean;
  isSetMenu: boolean;
  allowUserNotes: boolean;
  status: MenuItemStatus;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
  choiceGroups: MenuChoiceGroup[];
  poolLinks?: SetMenuPoolLinkRecord[];
};

export type MenuCategoryRecord = {
  id: string;
  nameEn: string;
  nameMm: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  items: MenuItemRecord[];
};

export type AdminRecommendedMenuItem = {
  id: string;
  menuCategoryId: string;
  menuItemId: string;
  displayOrder: number;
  badgeLabel: string | null;
  category: {
    id: string;
    nameEn: string;
    nameMm: string | null;
  };
  item: {
    id: string;
    nameEn: string;
    nameMm: string | null;
    descriptionEn: string | null;
    descriptionMm: string | null;
    price: number;
    imageUrl: string | null;
    placeholderIcon: string | null;
    isAvailable: boolean;
    status: MenuItemStatus;
    displayOrder: number;
  };
};

export type PublicMenuOption = {
  id: string;
  name: string;
  nameMm: string | null;
  extraPrice: number;
  isAvailable: boolean;
  displayOrder: number;
};

export type PublicMenuChoiceGroup = {
  id: string;
  title: string;
  titleMm: string | null;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  type: MenuChoiceGroupType;
  displayOrder: number;
  options: PublicMenuOption[];
};

export type PublicSetMenuPoolOption = {
  id: string;
  menuCode: string | null;
  name: string;
  nameMm: string | null;
  price: number;
  isAvailable: boolean;
  displayOrder: number;
};

export type PublicSetMenuPoolLink = {
  id: string;
  isPriceDetermining: boolean;
  usesOptionPrice: boolean;
  flatPrice: number | null;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  label: string | null;
  labelMm: string | null;
  displayOrder: number;
  pool: {
    id: string;
    name: string;
    nameMm: string | null;
    options: PublicSetMenuPoolOption[];
  };
};

export type PublicMenuItem = {
  id: string;
  name: string;
  nameMm: string | null;
  description: string | null;
  descriptionMm: string | null;
  price: number;
  imageUrl: string | null;
  placeholderIcon: string | null;
  menuCode: string | null;
  allowUserNotes: boolean;
  isAvailable: boolean;
  isSetMenu: boolean;
  choiceGroups: PublicMenuChoiceGroup[];
  poolLinks?: PublicSetMenuPoolLink[];
  displayOrder: number;
};

export type PublicMenuCategory = {
  id: string;
  name: string;
  nameMm: string | null;
  displayOrder: number;
  items: PublicMenuItem[];
};

export type PublicRecommendedMenuItem = {
  id: string;
  badgeLabel: string | null;
  category: {
    id: string;
    name: string;
    nameMm: string | null;
  };
  item: PublicMenuItem;
};
