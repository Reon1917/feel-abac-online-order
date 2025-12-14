import "server-only";

import { asc } from "drizzle-orm";
import { db } from "@/src/db/client";
import { menuCategories, menuItems } from "@/src/db/schema";

export type StockCategory = {
  id: string;
  nameEn: string;
  nameMm: string | null;
};

export type StockItem = {
  id: string;
  categoryId: string;
  menuCode: string | null;
  nameEn: string;
  nameMm: string | null;
  isAvailable: boolean;
};

export async function getStockControlData(): Promise<{
  categories: StockCategory[];
  items: StockItem[];
}> {
  const [categories, items] = await Promise.all([
    db
      .select({
        id: menuCategories.id,
        nameEn: menuCategories.nameEn,
        nameMm: menuCategories.nameMm,
      })
      .from(menuCategories)
      .orderBy(asc(menuCategories.displayOrder), asc(menuCategories.createdAt)),
    db
      .select({
        id: menuItems.id,
        categoryId: menuItems.categoryId,
        menuCode: menuItems.menuCode,
        nameEn: menuItems.nameEn,
        nameMm: menuItems.nameMm,
        isAvailable: menuItems.isAvailable,
      })
      .from(menuItems)
      .orderBy(asc(menuItems.displayOrder), asc(menuItems.createdAt)),
  ]);

  return { categories, items };
}
