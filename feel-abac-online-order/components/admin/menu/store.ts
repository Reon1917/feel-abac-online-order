"use client";

import { create } from "zustand";
import { MenuCategoryRecord } from "@/lib/menu/types";

function coerceNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function mergeItemWithUpdates(
  item: MenuCategoryRecord["items"][number],
  updates: Partial<MenuCategoryRecord["items"][number]>
) {
  const next: MenuCategoryRecord["items"][number] = {
    ...item,
    ...updates,
  };

  if (updates.price !== undefined || typeof next.price === "string") {
    const price = coerceNumber(updates.price ?? next.price);
    if (price !== undefined) {
      next.price = price;
    }
  }

  if (updates.displayOrder !== undefined || typeof next.displayOrder === "string") {
    const order = coerceNumber(updates.displayOrder ?? next.displayOrder);
    if (order !== undefined) {
      next.displayOrder = order;
    }
  }

  return next;
}

type AdminMenuState = {
  menu: MenuCategoryRecord[];
  selectedCategoryId: string | null;
  selectedItemId: string | null;
  isRefreshing: boolean;
  setMenu: (menu: MenuCategoryRecord[]) => void;
  setSelectedCategory: (categoryId: string | null) => void;
  setSelectedItem: (itemId: string | null) => void;
  setIsRefreshing: (value: boolean) => void;
  updateItem: (params: {
    itemId: string;
    categoryId: string;
    updates: Partial<MenuCategoryRecord["items"][number]>;
  }) => void;
};

export const useAdminMenuStore = create<AdminMenuState>((set) => ({
  menu: [],
  selectedCategoryId: null,
  selectedItemId: null,
  isRefreshing: false,
  setMenu: (menu) =>
    set((state) => {
      let nextCategoryId = state.selectedCategoryId;
      if (!nextCategoryId || !menu.some((category) => category.id === nextCategoryId)) {
        nextCategoryId = menu[0]?.id ?? null;
      }

      const activeCategory = nextCategoryId
        ? menu.find((category) => category.id === nextCategoryId)
        : undefined;

      let nextItemId = state.selectedItemId;
      if (
        !nextItemId ||
        (activeCategory && !activeCategory.items.some((item) => item.id === nextItemId))
      ) {
        nextItemId = activeCategory?.items[0]?.id ?? null;
      }

      return {
        menu,
        selectedCategoryId: nextCategoryId,
        selectedItemId: nextItemId,
      };
    }),
  setSelectedCategory: (categoryId) =>
    set((state) => {
      const menu = state.menu;
      const activeCategory = categoryId
        ? menu.find((category) => category.id === categoryId)
        : undefined;
      return {
        selectedCategoryId: categoryId,
        selectedItemId: activeCategory?.items[0]?.id ?? null,
      };
  }),
  setSelectedItem: (itemId) =>
    set(() => ({
      selectedItemId: itemId,
    })),
  setIsRefreshing: (value) =>
    set(() => ({
      isRefreshing: value,
    })),
  updateItem: ({ itemId, categoryId, updates }) =>
    set((state) => {
      const nextMenu = state.menu.map((category) => {
        if (category.id !== categoryId) {
          return category;
        }
        return {
          ...category,
          items: category.items.map((item) =>
            item.id === itemId ? mergeItemWithUpdates(item, updates) : item
          ),
        };
      });

      return {
        menu: nextMenu,
      };
    }),
}));
