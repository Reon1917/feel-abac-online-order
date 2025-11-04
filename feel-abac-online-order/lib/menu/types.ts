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
  allowUserNotes: boolean;
  status: MenuItemStatus;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
  choiceGroups: MenuChoiceGroup[];
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
  choiceGroups: PublicMenuChoiceGroup[];
  displayOrder: number;
};

export type PublicMenuCategory = {
  id: string;
  name: string;
  nameMm: string | null;
  displayOrder: number;
  items: PublicMenuItem[];
};
