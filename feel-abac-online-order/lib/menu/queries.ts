import "server-only";

import { unstable_cache } from "next/cache";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/src/db/client";
import {
  menuCategories,
  menuItems,
  menuChoiceGroups,
  menuChoiceOptions,
} from "@/src/db/schema";
import {
  MenuCategoryRecord,
  MenuChoiceGroup,
  MenuChoiceGroupType,
  MenuChoiceOption,
  MenuItemRecord,
  MenuItemStatus,
  PublicMenuCategory,
  PublicMenuChoiceGroup,
  PublicMenuItem,
  PublicMenuOption,
  PublicSetMenuPoolLink,
} from "@/lib/menu/types";
import { numericToNumber } from "@/lib/db/numeric";
import { getPoolLinksForMenuItem } from "./pool-queries";

export type PublicMenuItemWithCategory = {
  item: PublicMenuItem;
  category: {
    id: string;
    name: string;
    nameMm: string | null;
  };
};

function mapOptions(records: Array<typeof menuChoiceOptions.$inferSelect>) {
  return records.map<MenuChoiceOption>((option) => ({
    id: option.id,
    choiceGroupId: option.choiceGroupId,
    nameEn: option.nameEn,
    nameMm: option.nameMm,
    extraPrice: numericToNumber(option.extraPrice),
    isAvailable: option.isAvailable,
    displayOrder: option.displayOrder,
    createdAt: option.createdAt,
    updatedAt: option.updatedAt,
  }));
}

function mapChoiceGroups(
  records: Array<typeof menuChoiceGroups.$inferSelect>,
  optionsByGroupId: Map<string, MenuChoiceOption[]>
) {
  return records.map<MenuChoiceGroup>((group) => ({
    id: group.id,
    menuItemId: group.menuItemId,
    titleEn: group.titleEn,
    titleMm: group.titleMm,
    minSelect: group.minSelect,
    maxSelect: group.maxSelect,
    isRequired: group.isRequired,
    type: group.type as MenuChoiceGroupType,
    displayOrder: group.displayOrder,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    options: optionsByGroupId.get(group.id) ?? [],
  }));
}

export async function getAdminMenuHierarchy(): Promise<MenuCategoryRecord[]> {
  const categories = await db
    .select()
    .from(menuCategories)
    .orderBy(asc(menuCategories.displayOrder), asc(menuCategories.createdAt));

  if (categories.length === 0) {
    return [];
  }

  const categoryIds = categories.map((category) => category.id);

  const items = await db
    .select()
    .from(menuItems)
    .where(inArray(menuItems.categoryId, categoryIds))
    .orderBy(asc(menuItems.displayOrder), asc(menuItems.createdAt));

  const itemIds = items.map((item) => item.id);

  const groups = itemIds.length
    ? await db
        .select()
        .from(menuChoiceGroups)
        .where(inArray(menuChoiceGroups.menuItemId, itemIds))
        .orderBy(
          asc(menuChoiceGroups.displayOrder),
          asc(menuChoiceGroups.createdAt)
        )
    : [];

  const groupIds = groups.map((group) => group.id);

  const options = groupIds.length
    ? await db
        .select()
        .from(menuChoiceOptions)
        .where(inArray(menuChoiceOptions.choiceGroupId, groupIds))
        .orderBy(
          asc(menuChoiceOptions.displayOrder),
          asc(menuChoiceOptions.createdAt)
        )
    : [];

  const optionsByGroup = new Map<string, MenuChoiceOption[]>();
  for (const option of mapOptions(options)) {
    const current = optionsByGroup.get(option.choiceGroupId) ?? [];
    current.push(option);
    optionsByGroup.set(option.choiceGroupId, current);
  }

  const groupsByItem = new Map<string, MenuChoiceGroup[]>();
  for (const group of mapChoiceGroups(groups, optionsByGroup)) {
    const current = groupsByItem.get(group.menuItemId) ?? [];
    current.push(group);
    groupsByItem.set(group.menuItemId, current);
  }

  const itemsByCategory = new Map<string, MenuItemRecord[]>();
  for (const item of items) {
    const mapped: MenuItemRecord = {
      id: item.id,
      categoryId: item.categoryId,
      nameEn: item.nameEn,
      nameMm: item.nameMm,
      price: numericToNumber(item.price),
      imageUrl: item.imageUrl,
      hasImage: item.hasImage,
      placeholderIcon: item.placeholderIcon,
      menuCode: item.menuCode,
      descriptionEn: item.descriptionEn,
      descriptionMm: item.descriptionMm,
      isAvailable: item.isAvailable,
      isSetMenu: item.isSetMenu,
      allowUserNotes: item.allowUserNotes,
      status: item.status as MenuItemStatus,
      displayOrder: item.displayOrder,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      choiceGroups: groupsByItem.get(item.id) ?? [],
    };

    const current = itemsByCategory.get(item.categoryId) ?? [];
    current.push(mapped);
    itemsByCategory.set(item.categoryId, current);
  }

  return categories.map<MenuCategoryRecord>((category) => ({
    id: category.id,
    nameEn: category.nameEn,
    nameMm: category.nameMm,
    displayOrder: category.displayOrder,
    isActive: category.isActive,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    items: itemsByCategory.get(category.id) ?? [],
  }));
}

async function loadPublicMenuHierarchy(): Promise<PublicMenuCategory[]> {
  const categories = await db
    .select()
    .from(menuCategories)
    .where(eq(menuCategories.isActive, true))
    .orderBy(asc(menuCategories.displayOrder), asc(menuCategories.createdAt));

  if (categories.length === 0) {
    return [];
  }

  const categoryIds = categories.map((category) => category.id);

  const items = await db
    .select()
    .from(menuItems)
    .where(inArray(menuItems.categoryId, categoryIds))
    .orderBy(asc(menuItems.displayOrder), asc(menuItems.createdAt));

  const publishedItems = items.filter((item) => item.status === "published");
  const itemIds = publishedItems.map((item) => item.id);

  const groups = itemIds.length
    ? await db
        .select()
        .from(menuChoiceGroups)
        .where(inArray(menuChoiceGroups.menuItemId, itemIds))
        .orderBy(
          asc(menuChoiceGroups.displayOrder),
          asc(menuChoiceGroups.createdAt)
        )
    : [];

  const groupIds = groups.map((group) => group.id);

  const options = groupIds.length
    ? await db
        .select()
        .from(menuChoiceOptions)
        .where(inArray(menuChoiceOptions.choiceGroupId, groupIds))
        .orderBy(
          asc(menuChoiceOptions.displayOrder),
          asc(menuChoiceOptions.createdAt)
        )
    : [];

  const optionsByGroup = new Map<string, PublicMenuOption[]>();
  for (const option of options) {
    if (!option.isAvailable) continue;
    const mapped: PublicMenuOption = {
      id: option.id,
      name: option.nameEn,
      nameMm: option.nameMm,
      extraPrice: numericToNumber(option.extraPrice),
      isAvailable: option.isAvailable,
      displayOrder: option.displayOrder,
    };
    const current = optionsByGroup.get(option.choiceGroupId) ?? [];
    current.push(mapped);
    optionsByGroup.set(option.choiceGroupId, current);
  }

  const groupsByItem = new Map<string, PublicMenuChoiceGroup[]>();
  for (const group of groups) {
    const mapped: PublicMenuChoiceGroup = {
      id: group.id,
      title: group.titleEn,
      titleMm: group.titleMm,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      isRequired: group.isRequired,
      type: group.type as MenuChoiceGroupType,
      displayOrder: group.displayOrder,
      options: optionsByGroup.get(group.id) ?? [],
    };

    const current = groupsByItem.get(group.menuItemId) ?? [];
    current.push(mapped);
    groupsByItem.set(group.menuItemId, current);
  }

  const itemsByCategory = new Map<string, PublicMenuItem[]>();
  for (const item of publishedItems) {
    const mapped: PublicMenuItem = {
      id: item.id,
      name: item.nameEn,
      nameMm: item.nameMm,
      description: item.descriptionEn,
      descriptionMm: item.descriptionMm,
      price: numericToNumber(item.price),
      imageUrl: item.imageUrl,
      placeholderIcon: item.placeholderIcon,
      menuCode: item.menuCode,
      allowUserNotes: item.allowUserNotes,
      isAvailable: item.isAvailable,
      isSetMenu: item.isSetMenu,
      choiceGroups: groupsByItem.get(item.id) ?? [],
      displayOrder: item.displayOrder,
    };

    const current = itemsByCategory.get(item.categoryId) ?? [];
    current.push(mapped);
    itemsByCategory.set(item.categoryId, current);
  }

  return categories.map<PublicMenuCategory>((category) => ({
    id: category.id,
    name: category.nameEn,
    nameMm: category.nameMm,
    displayOrder: category.displayOrder,
    items: itemsByCategory.get(category.id) ?? [],
  }));
}

export const getPublicMenuHierarchy = unstable_cache(
  async () => loadPublicMenuHierarchy(),
  ["public-menu-hierarchy"],
  {
    tags: ["public-menu"],
    revalidate: 300,
  }
);

export async function getPublicMenuItemById(
  itemId: string
): Promise<PublicMenuItemWithCategory | null> {
  const normalizedId = itemId.trim();
  if (!normalizedId) {
    return null;
  }

  const itemRecord = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.id, normalizedId))
    .limit(1);

  const item = itemRecord[0];
  // Return null only if item doesn't exist or isn't published
  // Let the page handle isAvailable=false with a friendly message
  if (!item || item.status !== "published") {
    return null;
  }

  const categoryRecord = await db
    .select()
    .from(menuCategories)
    .where(eq(menuCategories.id, item.categoryId))
    .limit(1);

  const category = categoryRecord[0];
  if (!category || !category.isActive) {
    return null;
  }

  const groups = await db
    .select()
    .from(menuChoiceGroups)
    .where(eq(menuChoiceGroups.menuItemId, item.id))
    .orderBy(
      asc(menuChoiceGroups.displayOrder),
      asc(menuChoiceGroups.createdAt)
    );

  const groupIds = groups.map((group) => group.id);

  const options = groupIds.length
    ? await db
        .select()
        .from(menuChoiceOptions)
        .where(inArray(menuChoiceOptions.choiceGroupId, groupIds))
        .orderBy(
          asc(menuChoiceOptions.displayOrder),
          asc(menuChoiceOptions.createdAt)
        )
    : [];

  const optionsByGroup = new Map<string, PublicMenuOption[]>();
  for (const option of options) {
    if (!option.isAvailable) continue;
    const mapped: PublicMenuOption = {
      id: option.id,
      name: option.nameEn,
      nameMm: option.nameMm,
      extraPrice: numericToNumber(option.extraPrice),
      isAvailable: option.isAvailable,
      displayOrder: option.displayOrder,
    };
    const current = optionsByGroup.get(option.choiceGroupId) ?? [];
    current.push(mapped);
    optionsByGroup.set(option.choiceGroupId, current);
  }

  const mappedGroups: PublicMenuChoiceGroup[] = groups.map((group) => ({
    id: group.id,
    title: group.titleEn,
    titleMm: group.titleMm,
    minSelect: group.minSelect,
    maxSelect: group.maxSelect,
    isRequired: group.isRequired,
    type: group.type as MenuChoiceGroupType,
    displayOrder: group.displayOrder,
    options: optionsByGroup.get(group.id) ?? [],
  }));

  // Fetch pool links if it's a set menu
  let poolLinks: PublicSetMenuPoolLink[] | undefined;
  if (item.isSetMenu) {
    const links = await getPoolLinksForMenuItem(item.id);
    poolLinks = links.map((link) => ({
      id: link.id,
      isPriceDetermining: link.isPriceDetermining,
      usesOptionPrice: link.usesOptionPrice,
      flatPrice: link.flatPrice,
      isRequired: link.isRequired,
      minSelect: link.minSelect,
      maxSelect: link.maxSelect,
      label: link.labelEn,
      labelMm: link.labelMm,
      displayOrder: link.displayOrder,
      pool: {
        id: link.pool.id,
        name: link.pool.nameEn,
        nameMm: link.pool.nameMm,
        options: link.pool.options
          .filter((opt) => opt.isAvailable)
          .map((opt) => ({
            id: opt.id,
            menuCode: opt.menuCode,
            name: opt.nameEn,
            nameMm: opt.nameMm,
            price: opt.price,
            isAvailable: opt.isAvailable,
            displayOrder: opt.displayOrder,
          })),
      },
    }));
  }

  const mappedItem: PublicMenuItem = {
    id: item.id,
    name: item.nameEn,
    nameMm: item.nameMm,
    description: item.descriptionEn,
    descriptionMm: item.descriptionMm,
    price: numericToNumber(item.price),
    imageUrl: item.imageUrl,
    placeholderIcon: item.placeholderIcon,
    menuCode: item.menuCode,
    allowUserNotes: item.allowUserNotes,
    isAvailable: item.isAvailable,
    isSetMenu: item.isSetMenu,
    choiceGroups: mappedGroups,
    poolLinks,
    displayOrder: item.displayOrder,
  };

  return {
    item: mappedItem,
    category: {
      id: category.id,
      name: category.nameEn,
      nameMm: category.nameMm,
    },
  };
}
