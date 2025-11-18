import "server-only";

import { unstable_cache } from "next/cache";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/src/db/client";
import {
  menuCategories,
  menuChoiceGroups,
  menuChoiceOptions,
  menuItems,
  recommendedMenuItems,
} from "@/src/db/schema";
import {
  AdminRecommendedMenuItem,
  MenuChoiceGroupType,
  MenuItemStatus,
  PublicMenuChoiceGroup,
  PublicMenuItem,
  PublicMenuOption,
  PublicRecommendedMenuItem,
} from "@/lib/menu/types";
import { numericToNumber } from "./math";

export async function getAdminRecommendedMenuItems(): Promise<
  AdminRecommendedMenuItem[]
> {
  const rows = await db
    .select({
      recommendation: recommendedMenuItems,
      item: menuItems,
      category: menuCategories,
    })
    .from(recommendedMenuItems)
    .innerJoin(
      menuItems,
      eq(menuItems.id, recommendedMenuItems.menuItemId)
    )
    .innerJoin(
      menuCategories,
      eq(menuCategories.id, recommendedMenuItems.menuCategoryId)
    )
    .orderBy(
      asc(recommendedMenuItems.displayOrder),
      asc(recommendedMenuItems.createdAt)
    );

  return rows.map<AdminRecommendedMenuItem>((row) => ({
    id: row.recommendation.id,
    menuCategoryId: row.recommendation.menuCategoryId,
    menuItemId: row.recommendation.menuItemId,
    displayOrder: row.recommendation.displayOrder,
    badgeLabel: row.recommendation.badgeLabel,
    category: {
      id: row.category.id,
      nameEn: row.category.nameEn,
      nameMm: row.category.nameMm,
    },
    item: {
      id: row.item.id,
      nameEn: row.item.nameEn,
      nameMm: row.item.nameMm,
      descriptionEn: row.item.descriptionEn,
      descriptionMm: row.item.descriptionMm,
      price: numericToNumber(row.item.price),
      imageUrl: row.item.imageUrl,
      placeholderIcon: row.item.placeholderIcon,
      isAvailable: row.item.isAvailable,
      status: row.item.status as MenuItemStatus,
      displayOrder: row.item.displayOrder,
    },
  }));
}

async function loadPublicRecommendedMenuItems(): Promise<
  PublicRecommendedMenuItem[]
> {
  const rows = await db
    .select({
      recommendation: recommendedMenuItems,
      item: menuItems,
      category: menuCategories,
    })
    .from(recommendedMenuItems)
    .innerJoin(
      menuItems,
      eq(menuItems.id, recommendedMenuItems.menuItemId)
    )
    .innerJoin(
      menuCategories,
      eq(menuCategories.id, recommendedMenuItems.menuCategoryId)
    )
    .orderBy(
      asc(recommendedMenuItems.displayOrder),
      asc(recommendedMenuItems.createdAt)
    );

  const filtered = rows.filter(
    (row) =>
      row.item.status === "published" &&
      row.category.isActive
  );

  if (filtered.length === 0) {
    return [];
  }

  const itemIds = filtered.map((row) => row.item.id);

  const groups = await db
    .select()
    .from(menuChoiceGroups)
    .where(inArray(menuChoiceGroups.menuItemId, itemIds))
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

  return filtered.map<PublicRecommendedMenuItem>((row) => {
    const mappedItem: PublicMenuItem = {
      id: row.item.id,
      name: row.item.nameEn,
      nameMm: row.item.nameMm,
      description: row.item.descriptionEn,
      descriptionMm: row.item.descriptionMm,
      price: numericToNumber(row.item.price),
      imageUrl: row.item.imageUrl,
      placeholderIcon: row.item.placeholderIcon,
      menuCode: row.item.menuCode,
      allowUserNotes: row.item.allowUserNotes,
      isAvailable: row.item.isAvailable,
      choiceGroups: groupsByItem.get(row.item.id) ?? [],
      displayOrder: row.item.displayOrder,
    };

    return {
      id: row.recommendation.id,
      badgeLabel: row.recommendation.badgeLabel,
      category: {
        id: row.category.id,
        name: row.category.nameEn,
        nameMm: row.category.nameMm,
      },
      item: mappedItem,
    };
  });
}

export const getPublicRecommendedMenuItems = unstable_cache(
  async () => loadPublicRecommendedMenuItems(),
  ["public-menu-recommended"],
  {
    tags: ["public-menu"],
    revalidate: 300,
  }
);
