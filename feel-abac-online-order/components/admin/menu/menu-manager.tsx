"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { ChevronRightIcon, ImageIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MenuCategoryRecord,
  MenuItemRecord,
  MenuChoiceGroup,
  MenuChoiceOption,
} from "@/lib/menu/types";
import { cn } from "@/lib/utils";

type AdminMenuManagerProps = {
  initialMenu: MenuCategoryRecord[];
};

type ItemDraft = {
  nameEn: string;
  nameMm: string;
  descriptionEn: string;
  descriptionMm: string;
  placeholderIcon: string;
  price: string;
  isAvailable: boolean;
  allowUserNotes: boolean;
};

type CategoryDraft = {
  nameEn: string;
  nameMm: string;
  isActive: boolean;
};

const FALLBACK_IMAGE =
  "https://placehold.co/320x240/edf2f7/1f2933?text=Menu+preview";

const defaultHeaders = {
  "Content-Type": "application/json",
};

async function fetchJSON<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    let message = response.statusText;
    try {
      const data = await response.json();
      if (data?.error && typeof data.error === "string") {
        message = data.error;
      }
    } catch {
      // ignore parse errors
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

function createItemDraft(item?: MenuItemRecord | null): ItemDraft {
  if (!item) {
    return {
      nameEn: "",
      nameMm: "",
      descriptionEn: "",
      descriptionMm: "",
      placeholderIcon: "",
      price: "",
      isAvailable: true,
      allowUserNotes: false,
    };
  }

  return {
    nameEn: item.nameEn,
    nameMm: item.nameMm ?? "",
    descriptionEn: item.descriptionEn ?? "",
    descriptionMm: item.descriptionMm ?? "",
    placeholderIcon: item.placeholderIcon ?? "",
    price: item.price.toString(),
    isAvailable: item.isAvailable,
    allowUserNotes: item.allowUserNotes,
  };
}

function createCategoryDraft(category?: MenuCategoryRecord | null): CategoryDraft {
  if (!category) {
    return {
      nameEn: "",
      nameMm: "",
      isActive: true,
    };
  }

  return {
    nameEn: category.nameEn,
    nameMm: category.nameMm ?? "",
    isActive: category.isActive,
  };
}

function nextDisplayOrder(records: { displayOrder: number }[]) {
  if (records.length === 0) return 0;
  const max = Math.max(...records.map((record) => record.displayOrder ?? 0));
  return max + 1;
}

export function AdminMenuManager({ initialMenu }: AdminMenuManagerProps) {
  const [menu, setMenu] = useState<MenuCategoryRecord[]>(initialMenu);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    initialMenu[0]?.id ?? null
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    initialMenu[0]?.items?.[0]?.id ?? null
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>(
    createCategoryDraft()
  );
  const [previewLocale, setPreviewLocale] = useState<"en" | "mm">("en");

  const localize = useCallback(
    (en: string | null | undefined, mm?: string | null) => {
      if (previewLocale === "mm" && mm && mm.trim().length > 0) {
        return mm;
      }
      return en ?? "";
    },
    [previewLocale]
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedCategory = useMemo(() => {
    if (!selectedCategoryId) return null;
    return menu.find((category) => category.id === selectedCategoryId) ?? null;
  }, [menu, selectedCategoryId]);

  const selectedItem = useMemo(() => {
    if (!selectedCategory || !selectedItemId) return null;
    return (
      selectedCategory.items.find((item) => item.id === selectedItemId) ?? null
    );
  }, [selectedCategory, selectedItemId]);

  const [itemDraft, setItemDraft] = useState<ItemDraft>(
    createItemDraft(selectedItem)
  );

  useEffect(() => {
    setItemDraft(createItemDraft(selectedItem));
  }, [selectedItemId, selectedItem]);

  useEffect(() => {
    if (!selectedCategory && menu.length > 0) {
      setSelectedCategoryId(menu[0]?.id ?? null);
      setSelectedItemId(menu[0]?.items?.[0]?.id ?? null);
    }
  }, [menu, selectedCategory]);

  const refreshMenu = useCallback(
    async (nextSelection?: { categoryId?: string; itemId?: string }) => {
      setIsRefreshing(true);
      try {
        const data = await fetchJSON<{ menu: MenuCategoryRecord[] }>(
          "/api/admin/menu/tree",
          {
            method: "GET",
            cache: "no-store",
          }
        );
        setMenu(data.menu ?? []);

        const categoryId =
          nextSelection?.categoryId ??
          selectedCategoryId ??
          data.menu[0]?.id ??
          null;

        const category = data.menu.find((item) => item.id === categoryId);
        const itemId =
          nextSelection?.itemId ??
          selectedItemId ??
          category?.items?.[0]?.id ??
          null;

        setSelectedCategoryId(categoryId ?? null);
        setSelectedItemId(itemId ?? null);
      } catch (error) {
        console.error(error);
        toast.error(
          error instanceof Error ? error.message : "Failed to refresh menu"
        );
      } finally {
        setIsRefreshing(false);
      }
    },
    [selectedCategoryId, selectedItemId]
  );

  const handleCategorySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      nameEn: categoryDraft.nameEn.trim(),
      nameMm: categoryDraft.nameMm.trim() || undefined,
      isActive: categoryDraft.isActive,
      displayOrder: nextDisplayOrder(menu),
    };

    try {
      const { category } = await fetchJSON<{ category: MenuCategoryRecord }>(
        "/api/admin/menu/categories",
        {
          method: "POST",
          headers: defaultHeaders,
          body: JSON.stringify(payload),
        }
      );

      toast.success("Category created");
      setCategoryDraft(createCategoryDraft());
      setCategoryFormOpen(false);
      await refreshMenu({ categoryId: category.id, itemId: null });
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create category"
      );
    }
  };

  const handleCategoryEdit = async (
    categoryId: string,
    updates: Partial<CategoryDraft>
  ) => {
    try {
      await fetchJSON<{ category: MenuCategoryRecord }>(
        `/api/admin/menu/categories/${categoryId}`,
        {
          method: "PATCH",
          headers: defaultHeaders,
          body: JSON.stringify({
            nameEn: updates.nameEn?.trim(),
            nameMm: updates.nameMm?.trim() || undefined,
            isActive: updates.isActive,
          }),
        }
      );
      toast.success("Category updated");
      await refreshMenu();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update category"
      );
    }
  };

  const handleCategoryDelete = async (categoryId: string) => {
    if (
      !window.confirm(
        "Deleting this category removes all menu items under it. Continue?"
      )
    ) {
      return;
    }

    try {
      await fetchJSON<{ success: boolean }>(
        `/api/admin/menu/categories/${categoryId}`,
        { method: "DELETE" }
      );
      toast.success("Category deleted");
      await refreshMenu();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete category"
      );
    }
  };

  const isExistingItem = Boolean(selectedItem);

  const handleItemSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCategory) {
      toast.error("Select a category first");
      return;
    }

    const priceValue = Number(itemDraft.price);
    if (Number.isNaN(priceValue) || priceValue < 0) {
      toast.error("Price must be a non-negative number");
      return;
    }

    const payload = {
      nameEn: itemDraft.nameEn.trim(),
      nameMm: itemDraft.nameMm.trim() || undefined,
      descriptionEn: itemDraft.descriptionEn.trim() || undefined,
      descriptionMm: itemDraft.descriptionMm.trim() || undefined,
      placeholderIcon: itemDraft.placeholderIcon.trim() || undefined,
      price: priceValue,
      isAvailable: itemDraft.isAvailable,
      allowUserNotes: itemDraft.allowUserNotes,
    };

    try {
      if (isExistingItem && selectedItem) {
        const { item } = await fetchJSON<{ item: MenuItemRecord }>(
          `/api/admin/menu/items/${selectedItem.id}`,
          {
            method: "PATCH",
            headers: defaultHeaders,
            body: JSON.stringify({
              ...payload,
              categoryId: selectedCategory.id,
            }),
          }
        );
        toast.success("Menu item updated");
        await refreshMenu({
          categoryId: selectedCategory.id,
          itemId: item.id,
        });
      } else {
        const displayOrder = nextDisplayOrder(selectedCategory.items);
        const { item } = await fetchJSON<{ item: MenuItemRecord }>(
          "/api/admin/menu/items",
          {
            method: "POST",
            headers: defaultHeaders,
            body: JSON.stringify({
              ...payload,
              categoryId: selectedCategory.id,
              displayOrder,
            }),
          }
        );
        toast.success("Menu item created");
        await refreshMenu({
          categoryId: selectedCategory.id,
          itemId: item.id,
        });
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save menu item"
      );
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedItem) return;
    if (
      !window.confirm(
        "Deleting this menu item removes all choice groups and options. Continue?"
      )
    ) {
      return;
    }

    try {
      await fetchJSON<{ success: boolean }>(
        `/api/admin/menu/items/${selectedItem.id}`,
        { method: "DELETE" }
      );
      toast.success("Menu item deleted");
      await refreshMenu();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete menu item"
      );
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!selectedItem) {
      toast("Save the item before uploading an image.");
      return;
    }
    const formData = new FormData();
    formData.append("menuItemId", selectedItem.id);
    formData.append("file", file);
    try {
      const response = await fetch("/api/admin/menu/images", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "Image upload failed"
        );
      }
      toast.success("Image updated");
      await refreshMenu({
        categoryId: selectedCategory?.id,
        itemId: selectedItem.id,
      });
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload image"
      );
    }
  };

  const handleImageDelete = async () => {
    if (!selectedItem) return;
    try {
      await fetchJSON<{ success: boolean }>(
        `/api/admin/menu/images?menuItemId=${selectedItem.id}`,
        { method: "DELETE" }
      );
      toast.success("Image removed");
      await refreshMenu({
        categoryId: selectedCategory?.id,
        itemId: selectedItem.id,
      });
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to remove image"
      );
    }
  };

  const handleCreateGroup = async (values: {
    titleEn: string;
    titleMm?: string;
    minSelect: number;
    maxSelect: number;
    isRequired: boolean;
  }) => {
    if (!selectedItem) return;
    try {
      await fetchJSON<{ group: MenuChoiceGroup }>(
        "/api/admin/menu/choice-groups",
        {
          method: "POST",
          headers: defaultHeaders,
          body: JSON.stringify({
            ...values,
            menuItemId: selectedItem.id,
            displayOrder: nextDisplayOrder(selectedItem.choiceGroups),
          }),
        }
      );
      toast.success("Choice group created");
      await refreshMenu({
        categoryId: selectedCategory?.id,
        itemId: selectedItem.id,
      });
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create choice group"
      );
    }
  };

  const handleUpdateGroup = async (
    group: MenuChoiceGroup,
    values: Partial<{
      titleEn: string;
      titleMm: string;
      minSelect: number;
      maxSelect: number;
      isRequired: boolean;
    }>
  ) => {
    try {
      await fetchJSON<{ group: MenuChoiceGroup }>(
        `/api/admin/menu/choice-groups/${group.id}`,
        {
          method: "PATCH",
          headers: defaultHeaders,
          body: JSON.stringify(values),
        }
      );
      toast.success("Choice group updated");
      await refreshMenu({
        categoryId: selectedCategory?.id,
        itemId: selectedItem?.id ?? null,
      });
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update choice group"
      );
    }
  };

  const handleDeleteGroup = async (group: MenuChoiceGroup) => {
    if (
      !window.confirm(
        "Deleting this group removes all linked options. Continue?"
      )
    ) {
      return;
    }
    try {
      await fetchJSON<{ success: boolean }>(
        `/api/admin/menu/choice-groups/${group.id}`,
        { method: "DELETE" }
      );
      toast.success("Choice group deleted");
      await refreshMenu({
        categoryId: selectedCategory?.id,
        itemId: selectedItem?.id ?? null,
      });
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete choice group"
      );
    }
  };

  const handleCreateOption = async (
    group: MenuChoiceGroup,
    values: {
      nameEn: string;
      nameMm?: string;
      extraPrice: number;
      isAvailable: boolean;
    }
  ) => {
    try {
      await fetchJSON<{ option: MenuChoiceOption }>(
        "/api/admin/menu/choice-options",
        {
          method: "POST",
          headers: defaultHeaders,
          body: JSON.stringify({
            ...values,
            choiceGroupId: group.id,
            displayOrder: nextDisplayOrder(group.options),
          }),
        }
      );
      toast.success("Option added");
      await refreshMenu({
        categoryId: selectedCategory?.id,
        itemId: selectedItem?.id ?? null,
      });
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to add option"
      );
    }
  };

  const handleUpdateOption = async (
    option: MenuChoiceOption,
    values: Partial<{
      nameEn: string;
      nameMm: string;
      extraPrice: number;
      isAvailable: boolean;
    }>
  ) => {
    try {
      await fetchJSON<{ option: MenuChoiceOption }>(
        `/api/admin/menu/choice-options/${option.id}`,
        {
          method: "PATCH",
          headers: defaultHeaders,
          body: JSON.stringify(values),
        }
      );
      toast.success("Option updated");
      await refreshMenu({
        categoryId: selectedCategory?.id,
        itemId: selectedItem?.id ?? null,
      });
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update option"
      );
    }
  };

  const handleDeleteOption = async (option: MenuChoiceOption) => {
    if (!window.confirm("Remove this option?")) {
      return;
    }
    try {
      await fetchJSON<{ success: boolean }>(
        `/api/admin/menu/choice-options/${option.id}`,
        { method: "DELETE" }
      );
      toast.success("Option removed");
      await refreshMenu({
        categoryId: selectedCategory?.id,
        itemId: selectedItem?.id ?? null,
      });
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to remove option"
      );
    }
  };

  const activeImage = selectedItem?.imageUrl || FALLBACK_IMAGE;
  const computedPrice = (() => {
    const base = Number(itemDraft.price) || 0;
    if (!selectedItem) return base;
    const optionExtras = selectedItem.choiceGroups.flatMap((group) =>
      group.options.map((option) => option.extraPrice)
    );
    return base + optionExtras.reduce((acc, price) => acc + price, 0);
  })();

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Categories</h2>
            <p className="text-xs text-slate-500">
              Group items for the customer menu.
            </p>
          </div>
          <Button
            size="sm"
            variant={categoryFormOpen ? "secondary" : "outline"}
            onClick={() => setCategoryFormOpen((prev) => !prev)}
          >
            {categoryFormOpen ? "Close" : "New"}
          </Button>
        </header>

        {categoryFormOpen && (
          <form
            onSubmit={handleCategorySubmit}
            className="space-y-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3"
          >
            <Input
              value={categoryDraft.nameEn}
              onChange={(event) =>
                setCategoryDraft((prev) => ({
                  ...prev,
                  nameEn: event.target.value,
                }))
              }
              placeholder="English name *"
              required
            />
            <Input
              value={categoryDraft.nameMm}
              onChange={(event) =>
                setCategoryDraft((prev) => ({
                  ...prev,
                  nameMm: event.target.value,
                }))
              }
              placeholder="Burmese name"
            />
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={categoryDraft.isActive}
                onChange={(event) =>
                  setCategoryDraft((prev) => ({
                    ...prev,
                    isActive: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Category visible to customers
            </label>
            <Button size="sm" type="submit" className="w-full">
              Create category
            </Button>
          </form>
        )}

        <div className="space-y-2">
          {menu.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              No categories yet. Create your first category to start.
            </div>
          ) : (
            menu.map((category) => {
              const isActive = category.id === selectedCategoryId;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategoryId(category.id);
                    setSelectedItemId(category.items[0]?.id ?? null);
                  }}
                  className={cn(
                    "w-full rounded-lg border px-4 py-3 text-left transition",
                    isActive
                      ? "border-emerald-400 bg-emerald-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-emerald-300"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {localize(category.nameEn, category.nameMm)}
                    </p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        category.isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-600"
                      )}
                    >
                      {category.isActive ? "Active" : "Hidden"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{category.items.length} items</span>
                    <button
                      type="button"
                      className="text-emerald-600 hover:text-emerald-700"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleCategoryEdit(category.id, {
                          isActive: !category.isActive,
                        });
                      }}
                    >
                      {category.isActive ? "Hide" : "Activate"}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="mt-2 text-xs text-rose-500 hover:text-rose-600"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCategoryDelete(category.id);
                    }}
                  >
                    Delete category
                  </button>
                </button>
              );
            })
          )}
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => refreshMenu()}
          disabled={isRefreshing}
        >
          {isRefreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </aside>

      <section className="space-y-6">
        {selectedCategory ? (
          <Fragment>
            <header className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                {localize(selectedCategory.nameEn, selectedCategory.nameMm)}
              </span>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {localize(selectedCategory.nameEn, selectedCategory.nameMm)}
                  </h2>
                  <p className="text-sm text-slate-600">
                    Draft items, manage choice groups, and preview what customers see—all in one screen.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-1 text-xs font-semibold text-slate-600">
                    <button
                      type="button"
                      onClick={() => setPreviewLocale("en")}
                      className={cn(
                        "rounded-sm px-3 py-1 transition",
                        previewLocale === "en"
                          ? "bg-emerald-600 text-white"
                          : "text-slate-600 hover:text-emerald-600"
                      )}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewLocale("mm")}
                      className={cn(
                        "rounded-sm px-3 py-1 transition",
                        previewLocale === "mm"
                          ? "bg-emerald-600 text-white"
                          : "text-slate-600 hover:text-emerald-600"
                      )}
                    >
                      Burmese
                    </button>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setItemDraft(createItemDraft());
                      setSelectedItemId(null);
                    }}
                  >
                    <PlusIcon className="size-4" />
                    New item
                  </Button>
                  <Button size="sm" variant="ghost" disabled>
                    Reorder (coming soon)
                  </Button>
                </div>
              </div>
            </header>

            <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
              <aside className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Live preview
                  </h3>
                  <p className="text-xs text-slate-500">
                    See how the card appears on the customer menu.
                  </p>
                  <div className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="relative size-20 overflow-hidden rounded-md border border-slate-200 bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={activeImage}
                          alt={
                            previewLocale === "mm"
                              ? itemDraft.nameMm || itemDraft.nameEn || "Menu preview"
                              : itemDraft.nameEn || "Menu preview"
                          }
                          className="size-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-semibold text-slate-900">
                          {previewLocale === "mm"
                            ? itemDraft.nameMm || itemDraft.nameEn || "Untitled dish"
                            : itemDraft.nameEn || itemDraft.nameMm || "Untitled dish"}
                        </p>
                        <p className="text-xs text-slate-500 line-clamp-3">
                          {previewLocale === "mm"
                            ? itemDraft.descriptionMm ||
                              itemDraft.descriptionEn ||
                              "Add a short description so customers know what to expect."
                            : itemDraft.descriptionEn ||
                              itemDraft.descriptionMm ||
                              "Add a short description so customers know what to expect."}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-emerald-700">
                        ฿
                        {Number.isNaN(computedPrice)
                          ? "0.00"
                          : computedPrice.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {itemDraft.allowUserNotes ? "Notes enabled" : "Notes disabled"}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedCategory.items.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Items in this category
                    </h3>
                    <ul className="mt-3 space-y-2">
                      {selectedCategory.items.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedItemId(item.id)}
                            className={cn(
                              "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition",
                              selectedItemId === item.id
                                ? "border-emerald-400 bg-emerald-50"
                                : "border-slate-200 bg-white hover:border-emerald-300"
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <ChevronRightIcon className="size-4 text-slate-400" />
                              {localize(item.nameEn, item.nameMm)}
                            </span>
                            <span className="text-xs text-slate-500">
                              ฿{item.price.toFixed(2)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </aside>

              <div className="space-y-6">
                <form
                  onSubmit={handleItemSubmit}
                  className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {isExistingItem ? "Edit menu item" : "Create menu item"}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Fill out the basics before adding choice groups or options.
                      </p>
                    </div>
                    {isExistingItem && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleDeleteItem}
                      >
                        Delete item
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      value={itemDraft.nameEn}
                      onChange={(event) =>
                        setItemDraft((prev) => ({
                          ...prev,
                          nameEn: event.target.value,
                        }))
                      }
                      placeholder="English name *"
                      required
                    />
                    <Input
                      value={itemDraft.nameMm}
                      onChange={(event) =>
                        setItemDraft((prev) => ({
                          ...prev,
                          nameMm: event.target.value,
                        }))
                      }
                      placeholder="Burmese name"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Textarea
                      value={itemDraft.descriptionEn}
                      onChange={(event) =>
                        setItemDraft((prev) => ({
                          ...prev,
                          descriptionEn: event.target.value,
                        }))
                      }
                      placeholder="English description"
                      rows={3}
                    />
                    <Textarea
                      value={itemDraft.descriptionMm}
                      onChange={(event) =>
                        setItemDraft((prev) => ({
                          ...prev,
                          descriptionMm: event.target.value,
                        }))
                      }
                      placeholder="Burmese description"
                      rows={3}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">
                        Base price (THB)
                      </label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={itemDraft.price}
                        onChange={(event) =>
                          setItemDraft((prev) => ({
                            ...prev,
                            price: event.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">
                        Placeholder icon (emoji or keyword)
                      </label>
                      <Input
                        value={itemDraft.placeholderIcon}
                        onChange={(event) =>
                          setItemDraft((prev) => ({
                            ...prev,
                            placeholderIcon: event.target.value,
                          }))
                        }
                        placeholder="e.g., 🍛"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      Image
                    </label>
                    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                      <div className="flex items-center gap-3 text-sm text-slate-600">
                        <ImageIcon className="size-5 text-emerald-500" />
                        <span>
                          {selectedItem?.hasImage
                            ? "Replace the feature image."
                            : "Upload a hero image for this dish (optional)."}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              void handleImageUpload(file);
                              if (fileInputRef.current) {
                                fileInputRef.current.value = "";
                              }
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={!selectedItem}
                        >
                          {selectedItem ? "Upload image" : "Save item first"}
                        </Button>
                        {selectedItem?.hasImage && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleImageDelete}
                          >
                            Remove image
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        Optimal size 1200×900px. We cache images for a long time—uploading a new one auto-generates a fresh URL.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={itemDraft.isAvailable}
                        onChange={(event) =>
                          setItemDraft((prev) => ({
                            ...prev,
                            isAvailable: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      Show to customers
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={itemDraft.allowUserNotes}
                        onChange={(event) =>
                          setItemDraft((prev) => ({
                            ...prev,
                            allowUserNotes: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      Allow customer notes
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button type="submit">
                      {isExistingItem ? "Update item" : "Save and continue"}
                    </Button>
                  </div>
                </form>

                {isExistingItem && selectedItem && (
                  <ChoiceGroupSection
                    key={selectedItem.id}
                    item={selectedItem}
                    locale={previewLocale}
                    onCreateGroup={handleCreateGroup}
                    onUpdateGroup={handleUpdateGroup}
                    onDeleteGroup={handleDeleteGroup}
                    onCreateOption={handleCreateOption}
                    onUpdateOption={handleUpdateOption}
                    onDeleteOption={handleDeleteOption}
                  />
                )}
              </div>
            </div>
          </Fragment>
        ) : (
          <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
            Create a category to get started.
          </div>
        )}
      </section>
    </div>
  );
}

type ChoiceGroupSectionProps = {
  item: MenuItemRecord;
  locale: "en" | "mm";
  onCreateGroup: (values: {
    titleEn: string;
    titleMm?: string;
    minSelect: number;
    maxSelect: number;
    isRequired: boolean;
  }) => Promise<void>;
  onUpdateGroup: (
    group: MenuChoiceGroup,
    values: Partial<{
      titleEn: string;
      titleMm: string;
      minSelect: number;
      maxSelect: number;
      isRequired: boolean;
    }>
  ) => Promise<void>;
  onDeleteGroup: (group: MenuChoiceGroup) => Promise<void>;
  onCreateOption: (
    group: MenuChoiceGroup,
    values: {
      nameEn: string;
      nameMm?: string;
      extraPrice: number;
      isAvailable: boolean;
    }
  ) => Promise<void>;
  onUpdateOption: (
    option: MenuChoiceOption,
    values: Partial<{
      nameEn: string;
      nameMm: string;
      extraPrice: number;
      isAvailable: boolean;
    }>
  ) => Promise<void>;
  onDeleteOption: (option: MenuChoiceOption) => Promise<void>;
};

function ChoiceGroupSection({
  item,
  locale,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onCreateOption,
  onUpdateOption,
  onDeleteOption,
}: ChoiceGroupSectionProps) {
  const [groupDraft, setGroupDraft] = useState(() => ({
    titleEn: "",
    titleMm: "",
    minSelect: 0,
    maxSelect: 1,
    isRequired: false,
  }));

  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  const handleGroupSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (groupDraft.maxSelect < groupDraft.minSelect) {
      toast.error("Max select must be greater than or equal to min select");
      return;
    }
    if (!groupDraft.titleEn.trim()) {
      toast.error("English title is required");
      return;
    }
    await onCreateGroup({
      titleEn: groupDraft.titleEn.trim(),
      titleMm: groupDraft.titleMm.trim() || undefined,
      minSelect: groupDraft.minSelect,
      maxSelect: groupDraft.maxSelect,
      isRequired: groupDraft.isRequired,
    });
    setGroupDraft({
      titleEn: "",
      titleMm: "",
      minSelect: 0,
      maxSelect: 1,
      isRequired: false,
    });
  };

  const sortedGroups = [...item.choiceGroups].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
      <h3 className="text-lg font-semibold text-slate-900">Choice groups</h3>
          <p className="text-xs text-slate-500">
            Use these for proteins, toppings, or add-on selections.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleGroupSubmit}
        className="space-y-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-4"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            value={groupDraft.titleEn}
            onChange={(event) =>
              setGroupDraft((prev) => ({
                ...prev,
                titleEn: event.target.value,
              }))
            }
            placeholder="English title *"
            required
          />
          <Input
            value={groupDraft.titleMm}
            onChange={(event) =>
              setGroupDraft((prev) => ({
                ...prev,
                titleMm: event.target.value,
              }))
            }
            placeholder="Burmese title"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            type="number"
            min={0}
            value={groupDraft.minSelect}
            onChange={(event) =>
              setGroupDraft((prev) => ({
                ...prev,
                minSelect: Number(event.target.value),
              }))
            }
            placeholder="Min select"
          />
          <Input
            type="number"
            min={1}
            value={groupDraft.maxSelect}
            onChange={(event) =>
              setGroupDraft((prev) => ({
                ...prev,
                maxSelect: Number(event.target.value),
              }))
            }
            placeholder="Max select"
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={groupDraft.isRequired}
              onChange={(event) =>
                setGroupDraft((prev) => ({
                  ...prev,
                  isRequired: event.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Required group
          </label>
        </div>
        <Button type="submit" size="sm">
          Add group
        </Button>
      </form>

      {sortedGroups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
          No choice groups yet. Add one above to start collecting options.
        </div>
      ) : (
        <div className="space-y-4">
          {sortedGroups.map((group) => (
            <GroupCard
              key={`${group.id}-${group.options.length}`}
              group={group}
              locale={locale}
              expanded={expandedGroupId === group.id}
              onToggle={() =>
                setExpandedGroupId((prev) =>
                  prev === group.id ? null : group.id
                )
              }
              onUpdateGroup={onUpdateGroup}
              onDeleteGroup={onDeleteGroup}
              onCreateOption={onCreateOption}
              onUpdateOption={onUpdateOption}
              onDeleteOption={onDeleteOption}
            />
          ))}
        </div>
      )}
    </section>
  );
}

type GroupCardProps = {
  group: MenuChoiceGroup;
  expanded: boolean;
  onToggle: () => void;
  locale: "en" | "mm";
  onUpdateGroup: ChoiceGroupSectionProps["onUpdateGroup"];
  onDeleteGroup: ChoiceGroupSectionProps["onDeleteGroup"];
  onCreateOption: ChoiceGroupSectionProps["onCreateOption"];
  onUpdateOption: ChoiceGroupSectionProps["onUpdateOption"];
  onDeleteOption: ChoiceGroupSectionProps["onDeleteOption"];
};

function GroupCard({
  group,
  expanded,
  onToggle,
  locale,
  onUpdateGroup,
  onDeleteGroup,
  onCreateOption,
  onUpdateOption,
  onDeleteOption,
}: GroupCardProps) {
  const [optionDrafts, setOptionDrafts] = useState<
    Record<
      string,
      {
        nameEn: string;
        nameMm: string;
        extraPrice: string;
        isAvailable: boolean;
      }
    >
  >({});

  const blankOption = {
    nameEn: "",
    nameMm: "",
    extraPrice: "",
    isAvailable: true,
  };

  const sortedOptions = [...group.options].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  const handleOptionChange = (
    optionId: string,
    field: keyof typeof blankOption,
    value: string | boolean
  ) => {
    setOptionDrafts((prev) => ({
      ...prev,
      [optionId]: {
        ...(prev[optionId] ?? blankOption),
        [field]: value,
      },
    }));
  };

  const draftFor = (optionId: string) =>
    optionDrafts[optionId] ?? {
      nameEn: "",
      nameMm: "",
      extraPrice: "",
      isAvailable: true,
    };

  const handleAddOption = async () => {
    const newDraft = draftFor("new");
    if (!newDraft.nameEn.trim()) {
      toast.error("English name is required");
      return;
    }
    const extraPrice = Number(newDraft.extraPrice) || 0;
    await onCreateOption(group, {
      nameEn: newDraft.nameEn.trim(),
      nameMm: newDraft.nameMm.trim() || undefined,
      extraPrice,
      isAvailable: newDraft.isAvailable,
    });
    setOptionDrafts((prev) => ({
      ...prev,
      new: blankOption,
    }));
  };

  const handleOptionUpdate = async (option: MenuChoiceOption) => {
    const draft = draftFor(option.id);
    const payload: Partial<{
      nameEn: string;
      nameMm: string;
      extraPrice: number;
      isAvailable: boolean;
    }> = {};

    if (draft.nameEn.trim() && draft.nameEn.trim() !== option.nameEn) {
      payload.nameEn = draft.nameEn.trim();
    }
    if (draft.nameMm.trim() !== (option.nameMm ?? "")) {
      payload.nameMm = draft.nameMm.trim() || undefined;
    }
    if (draft.extraPrice !== "" && Number(draft.extraPrice) !== option.extraPrice) {
      payload.extraPrice = Number(draft.extraPrice);
    }
    if (draft.isAvailable !== option.isAvailable) {
      payload.isAvailable = draft.isAvailable;
    }
    if (Object.keys(payload).length === 0) {
      toast("No changes to save");
      return;
    }
    await onUpdateOption(option, payload);
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm"
      >
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-slate-900">
            {locale === "mm"
              ? group.titleMm || group.titleEn
              : group.titleEn}
          </span>
          <span className="text-xs text-slate-500">
            Min {group.minSelect} · Max {group.maxSelect} ·{" "}
            {group.isRequired ? "Required" : "Optional"}
          </span>
        </div>
        <ChevronRightIcon
          className={cn(
            "size-4 text-slate-400 transition-transform",
            expanded && "rotate-90"
          )}
        />
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-slate-200 p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <button
              type="button"
              className="text-emerald-600 hover:text-emerald-700"
              onClick={() =>
                onUpdateGroup(group, { isRequired: !group.isRequired })
              }
            >
              Toggle required
            </button>
            <span>•</span>
            <button
              type="button"
              className="text-emerald-600 hover:text-emerald-700"
              onClick={() =>
                onUpdateGroup(group, {
                  minSelect: Math.max(0, group.minSelect - 1),
                })
              }
            >
              Min -1
            </button>
            <button
              type="button"
              className="text-emerald-600 hover:text-emerald-700"
              onClick={() =>
                onUpdateGroup(group, { minSelect: group.minSelect + 1 })
              }
            >
              Min +1
            </button>
            <span>•</span>
            <button
              type="button"
              className="text-emerald-600 hover:text-emerald-700"
              onClick={() =>
                onUpdateGroup(group, {
                  maxSelect: Math.max(group.minSelect, group.maxSelect - 1),
                })
              }
            >
              Max -1
            </button>
            <button
              type="button"
              className="text-emerald-600 hover:text-emerald-700"
              onClick={() =>
                onUpdateGroup(group, { maxSelect: group.maxSelect + 1 })
              }
            >
              Max +1
            </button>
            <span>•</span>
            <button
              type="button"
              className="text-rose-500 hover:text-rose-600"
              onClick={() => onDeleteGroup(group)}
            >
              Delete group
            </button>
          </div>

          <div className="space-y-2">
            {sortedOptions.length === 0 ? (
              <div className="rounded border border-dashed border-slate-200 p-3 text-xs text-slate-500">
                No options yet. Add the first one below.
              </div>
            ) : (
              sortedOptions.map((option) => (
                <div
                  key={option.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
                >
                  <div className="grid gap-2 md:grid-cols-3">
                    <Input
                      placeholder="English name"
                      defaultValue={option.nameEn}
                      onChange={(event) =>
                        handleOptionChange(
                          option.id,
                          "nameEn",
                          event.target.value
                        )
                      }
                    />
                    <Input
                      placeholder="Burmese name"
                      defaultValue={option.nameMm ?? ""}
                      onChange={(event) =>
                        handleOptionChange(
                          option.id,
                          "nameMm",
                          event.target.value
                        )
                      }
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Extra price"
                      defaultValue={option.extraPrice.toFixed(2)}
                      onChange={(event) =>
                        handleOptionChange(
                          option.id,
                          "extraPrice",
                          event.target.value
                        )
                      }
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 text-slate-600">
                      <input
                        type="checkbox"
                        defaultChecked={option.isAvailable}
                        onChange={(event) =>
                          handleOptionChange(
                            option.id,
                            "isAvailable",
                            event.target.checked
                          )
                        }
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      Available
                    </label>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => handleOptionUpdate(option)}
                      >
                        Save changes
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        type="button"
                        onClick={() => onDeleteOption(option)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-slate-900">
              Add new option
            </h4>
            <p className="text-xs text-slate-500">
              Extra price is added to the base price at checkout.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Input
                placeholder="English name"
                value={draftFor("new").nameEn}
                onChange={(event) =>
                  handleOptionChange("new", "nameEn", event.target.value)
                }
              />
              <Input
                placeholder="Burmese name"
                value={draftFor("new").nameMm}
                onChange={(event) =>
                  handleOptionChange("new", "nameMm", event.target.value)
                }
              />
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="Extra price"
                value={draftFor("new").extraPrice}
                onChange={(event) =>
                  handleOptionChange("new", "extraPrice", event.target.value)
                }
              />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={draftFor("new").isAvailable}
                  onChange={(event) =>
                    handleOptionChange("new", "isAvailable", event.target.checked)
                  }
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Available
              </label>
              <Button size="sm" type="button" onClick={handleAddOption}>
                Add option
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
