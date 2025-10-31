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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MenuCategoryRecord, MenuItemRecord } from "@/lib/menu/types";
import { cn } from "@/lib/utils";

type AdminMenuManagerProps = {
  initialMenu: MenuCategoryRecord[];
};

type CategoryDialogState =
  | null
  | {
      mode: "create";
    }
  | {
      mode: "edit";
      category: MenuCategoryRecord;
    };

type ItemDialogState =
  | null
  | {
      mode: "create";
      categoryId: string;
    }
  | {
      mode: "edit";
      categoryId: string;
      item: MenuItemRecord;
    };

type GroupDialogState =
  | null
  | {
      mode: "create";
      menuItemId: string;
    }
  | {
      mode: "edit";
      menuItemId: string;
      group: MenuItemRecord["choiceGroups"][number];
    };

type OptionDialogState =
  | null
  | {
      mode: "create";
      choiceGroupId: string;
    }
  | {
      mode: "edit";
      choiceGroupId: string;
      option: MenuItemRecord["choiceGroups"][number]["options"][number];
    };

type ImageDialogState =
  | null
  | {
      item: MenuItemRecord;
    };

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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

export function AdminMenuManager({ initialMenu }: AdminMenuManagerProps) {
  const [menu, setMenu] = useState<MenuCategoryRecord[]>(initialMenu);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    initialMenu[0]?.id ?? null
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [categoryDialog, setCategoryDialog] =
    useState<CategoryDialogState>(null);
  const [itemDialog, setItemDialog] = useState<ItemDialogState>(null);
  const [groupDialog, setGroupDialog] = useState<GroupDialogState>(null);
  const [optionDialog, setOptionDialog] = useState<OptionDialogState>(null);
  const [imageDialog, setImageDialog] = useState<ImageDialogState>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshMenu = useCallback(async () => {
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
      if (data.menu.length === 0) {
        setSelectedCategoryId(null);
        setSelectedItemId(null);
      } else if (
        selectedCategoryId &&
        !data.menu.some((category) => category.id === selectedCategoryId)
      ) {
        setSelectedCategoryId(data.menu[0]?.id ?? null);
        setSelectedItemId(null);
      } else if (selectedCategoryId) {
        const activeCategory = data.menu.find(
          (category) => category.id === selectedCategoryId
        );
        if (
          activeCategory &&
          selectedItemId &&
          !activeCategory.items.some((item) => item.id === selectedItemId)
        ) {
          setSelectedItemId(
            activeCategory.items.length > 0
              ? activeCategory.items[0].id
              : null
          );
        }
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to refresh menu");
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedCategoryId, selectedItemId]);

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

  const handleCreateOrEditCategory = useCallback(
    async (values: {
      nameEn: string;
      nameMm?: string;
      displayOrder?: number;
      isActive?: boolean;
    }) => {
      if (categoryDialog?.mode === "edit" && categoryDialog.category) {
        await fetchJSON<{ category: MenuCategoryRecord }>(
          `/api/admin/menu/categories/${categoryDialog.category.id}`,
          {
            method: "PATCH",
            headers: defaultHeaders,
            body: JSON.stringify(values),
          }
        );
        toast.success("Category updated");
      } else {
        await fetchJSON<{ category: MenuCategoryRecord }>(
          "/api/admin/menu/categories",
          {
            method: "POST",
            headers: defaultHeaders,
            body: JSON.stringify(values),
          }
        );
        toast.success("Category created");
      }
      await refreshMenu();
      setCategoryDialog(null);
    },
    [categoryDialog, refreshMenu]
  );

  const handleDeleteCategory = useCallback(
    async (categoryId: string) => {
      if (
        !window.confirm(
          "Deleting this category will remove all menu items under it. Continue?"
        )
      ) {
        return;
      }

      await fetchJSON<{ success: boolean }>(
        `/api/admin/menu/categories/${categoryId}`,
        {
          method: "DELETE",
        }
      );
      toast.success("Category deleted");
      await refreshMenu();
    },
    [refreshMenu]
  );

  const handleCreateOrEditItem = useCallback(
    async (
      categoryId: string,
      values: {
        nameEn: string;
        nameMm?: string;
        descriptionEn?: string;
        descriptionMm?: string;
        placeholderIcon?: string;
        price: number;
        isAvailable?: boolean;
        allowUserNotes?: boolean;
        displayOrder?: number;
      }
    ) => {
      if (itemDialog?.mode === "edit" && itemDialog.item) {
        await fetchJSON<{ item: MenuItemRecord }>(
          `/api/admin/menu/items/${itemDialog.item.id}`,
          {
            method: "PATCH",
            headers: defaultHeaders,
            body: JSON.stringify({
              ...values,
              categoryId,
            }),
          }
        );
        toast.success("Menu item updated");
      } else {
        await fetchJSON<{ item: MenuItemRecord }>(
          "/api/admin/menu/items",
          {
            method: "POST",
            headers: defaultHeaders,
            body: JSON.stringify({
              ...values,
              categoryId,
            }),
          }
        );
        toast.success("Menu item created");
      }
      await refreshMenu();
      setItemDialog(null);
    },
    [itemDialog, refreshMenu]
  );

  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      if (
        !window.confirm(
          "Deleting this menu item will remove all choice groups and options. Continue?"
        )
      ) {
        return;
      }

      await fetchJSON<{ success: boolean }>(
        `/api/admin/menu/items/${itemId}`,
        {
          method: "DELETE",
        }
      );
      toast.success("Menu item deleted");
      await refreshMenu();
    },
    [refreshMenu]
  );

  const handleCreateOrEditGroup = useCallback(
    async (
      menuItemId: string,
      values: {
        titleEn: string;
        titleMm?: string;
        minSelect: number;
        maxSelect: number;
        isRequired?: boolean;
        displayOrder?: number;
      }
    ) => {
      if (groupDialog?.mode === "edit" && groupDialog.group) {
        await fetchJSON(`/api/admin/menu/choice-groups/${groupDialog.group.id}`, {
          method: "PATCH",
          headers: defaultHeaders,
          body: JSON.stringify({
            ...values,
            menuItemId,
          }),
        });
        toast.success("Choice group updated");
      } else {
        await fetchJSON("/api/admin/menu/choice-groups", {
          method: "POST",
          headers: defaultHeaders,
          body: JSON.stringify({
            ...values,
            menuItemId,
          }),
        });
        toast.success("Choice group created");
      }
      await refreshMenu();
      setGroupDialog(null);
    },
    [groupDialog, refreshMenu]
  );

  const handleDeleteGroup = useCallback(
    async (groupId: string) => {
      if (
        !window.confirm(
          "Deleting this choice group will remove all options inside it. Continue?"
        )
      ) {
        return;
      }

      await fetchJSON<{ success: boolean }>(
        `/api/admin/menu/choice-groups/${groupId}`,
        {
          method: "DELETE",
        }
      );
      toast.success("Choice group deleted");
      await refreshMenu();
    },
    [refreshMenu]
  );

  const handleCreateOrEditOption = useCallback(
    async (
      choiceGroupId: string,
      values: {
        nameEn: string;
        nameMm?: string;
        extraPrice: number;
        isAvailable?: boolean;
        displayOrder?: number;
      }
    ) => {
      if (optionDialog?.mode === "edit" && optionDialog.option) {
        await fetchJSON(
          `/api/admin/menu/choice-options/${optionDialog.option.id}`,
          {
            method: "PATCH",
            headers: defaultHeaders,
            body: JSON.stringify({
              ...values,
              choiceGroupId,
            }),
          }
        );
        toast.success("Choice option updated");
      } else {
        await fetchJSON("/api/admin/menu/choice-options", {
          method: "POST",
          headers: defaultHeaders,
          body: JSON.stringify({
            ...values,
            choiceGroupId,
          }),
        });
        toast.success("Choice option created");
      }
      await refreshMenu();
      setOptionDialog(null);
    },
    [optionDialog, refreshMenu]
  );

  const handleDeleteOption = useCallback(
    async (optionId: string) => {
      await fetchJSON<{ success: boolean }>(
        `/api/admin/menu/choice-options/${optionId}`,
        {
          method: "DELETE",
        }
      );
      toast.success("Choice option removed");
      await refreshMenu();
    },
    [refreshMenu]
  );

  const handleImageUpload = useCallback(
    async (itemId: string, file: File) => {
      const formData = new FormData();
      formData.append("menuItemId", itemId);
      formData.append("file", file);

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

      await refreshMenu();
      toast.success("Image updated");
    },
    [refreshMenu]
  );

  const handleImageDelete = useCallback(
    async (itemId: string) => {
      await fetchJSON<{ success: boolean }>(
        `/api/admin/menu/images?menuItemId=${itemId}`,
        {
          method: "DELETE",
        }
      );
      toast.success("Image removed");
      await refreshMenu();
    },
    [refreshMenu]
  );

  return (
    <div className="grid gap-6 md:grid-cols-[260px_1fr]">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Categories</h2>
          <Button
            size="sm"
            onClick={() => setCategoryDialog({ mode: "create" })}
          >
            New
          </Button>
        </div>
        <div className="space-y-2">
          {menu.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              No categories yet. Create your first category to start building the
              menu.
            </div>
          ) : (
            menu.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  setSelectedCategoryId(category.id);
                  setSelectedItemId(
                    category.items.length > 0
                      ? category.items[0].id
                      : null
                  );
                }}
                className={cn(
                  "w-full rounded-lg border px-4 py-3 text-left transition",
                  selectedCategoryId === category.id
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40"
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {category.nameEn}
                    </p>
                    {category.nameMm && (
                      <p className="text-xs text-slate-500">
                        {category.nameMm}
                      </p>
                    )}
                  </div>
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
              </button>
            ))
          )}
        </div>
        <div>
          <Button
            variant="outline"
            className="w-full"
            onClick={refreshMenu}
            disabled={isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </section>

      <section className="space-y-6">
        {selectedCategory ? (
          <Fragment>
            <header className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-xl font-semibold text-slate-900">
                    {selectedCategory.nameEn}
                  </h1>
                  <p className="text-sm text-slate-600">
                    Control visibility, order, and localized names for this category.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setCategoryDialog({
                        mode: "edit",
                        category: selectedCategory,
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => handleDeleteCategory(selectedCategory.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              <dl className="grid gap-2 md:grid-cols-2">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Display order
                  </dt>
                  <dd className="text-sm text-slate-900">
                    {selectedCategory.displayOrder}
                  </dd>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Burmese label
                  </dt>
                  <dd className="text-sm text-slate-900">
                    {selectedCategory.nameMm ?? "—"}
                  </dd>
                </div>
              </dl>
            </header>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Menu items
                </h2>
                <Button
                  size="sm"
                  onClick={() =>
                    setItemDialog({
                      mode: "create",
                      categoryId: selectedCategory.id,
                    })
                  }
                >
                  Add item
                </Button>
              </div>

              {selectedCategory.items.length === 0 ? (
                <div className="mt-5 rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  No menu items in this category yet. Add your first dish.
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  {selectedCategory.items.map((item) => (
                    <article
                      key={item.id}
                      className={cn(
                        "rounded-lg border border-slate-200 p-4 transition",
                        selectedItem?.id === item.id
                          ? "border-emerald-400 bg-emerald-50/50"
                          : "bg-white"
                      )}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold text-slate-900">
                              {item.nameEn}
                            </h3>
                            {!item.isAvailable && (
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                                Hidden
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-600">
                            {item.descriptionEn ?? "No description"}
                          </p>
                          <div className="text-sm text-slate-900">
                            Base price: ฿{numberFormatter.format(item.price)}
                          </div>
                          <div className="text-xs text-slate-500">
                            Display order: {item.displayOrder}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedItemId(item.id);
                              setItemDialog({
                                mode: "edit",
                                categoryId: selectedCategory.id,
                                item,
                              });
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedItemId(item.id);
                              setGroupDialog({
                                mode: "create",
                                menuItemId: item.id,
                              });
                            }}
                          >
                            Add choice group
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setImageDialog({ item });
                            }}
                          >
                            {item.hasImage ? "Replace image" : "Add image"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>

                      {item.choiceGroups.length > 0 && (
                        <div className="mt-4 space-y-4">
                          {item.choiceGroups.map((group) => (
                            <div
                              key={group.id}
                              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">
                                    {group.titleEn}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    Min {group.minSelect} · Max {group.maxSelect}{" "}
                                    {group.isRequired ? "· Required" : "· Optional"}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setGroupDialog({
                                        mode: "edit",
                                        menuItemId: item.id,
                                        group,
                                      })
                                    }
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setOptionDialog({
                                        mode: "create",
                                        choiceGroupId: group.id,
                                      })
                                    }
                                  >
                                    Add option
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteGroup(group.id)}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </div>

                              {group.options.length === 0 ? (
                                <div className="mt-3 rounded border border-dashed border-slate-200 p-3 text-xs text-slate-500">
                                  No options yet.
                                </div>
                              ) : (
                                <ul className="mt-3 space-y-2">
                                  {group.options.map((option) => (
                                    <li
                                      key={option.id}
                                      className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-sm"
                                    >
                                      <div>
                                        <p className="font-medium text-slate-900">
                                          {option.nameEn}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                          Extra: ฿
                                          {numberFormatter.format(option.extraPrice)}
                                        </p>
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            setOptionDialog({
                                              mode: "edit",
                                              choiceGroupId: group.id,
                                              option,
                                            })
                                          }
                                        >
                                          Edit
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() =>
                                            handleDeleteOption(option.id)
                                          }
                                        >
                                          Delete
                                        </Button>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </Fragment>
        ) : (
          <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
            Select a category to manage its items, or create a new category.
          </div>
        )}
      </section>

      <CategoryDialog
        state={categoryDialog}
        onClose={() => setCategoryDialog(null)}
        onSubmit={handleCreateOrEditCategory}
      />

      <ItemDialog
        state={itemDialog}
        onClose={() => setItemDialog(null)}
        onSubmit={handleCreateOrEditItem}
      />

      <GroupDialog
        state={groupDialog}
        onClose={() => setGroupDialog(null)}
        onSubmit={handleCreateOrEditGroup}
      />

      <OptionDialog
        state={optionDialog}
        onClose={() => setOptionDialog(null)}
        onSubmit={handleCreateOrEditOption}
      />

      <ImageDialog
        state={imageDialog}
        onClose={() => setImageDialog(null)}
        onUpload={handleImageUpload}
        onDelete={handleImageDelete}
        fileInputRef={fileInputRef}
      />
    </div>
  );
}

type CategoryDialogProps = {
  state: CategoryDialogState;
  onClose: () => void;
  onSubmit: (values: {
    nameEn: string;
    nameMm?: string;
    displayOrder?: number;
    isActive?: boolean;
  }) => Promise<void>;
};

function CategoryDialog({ state, onClose, onSubmit }: CategoryDialogProps) {
  const [formState, setFormState] = useState({
    nameEn: "",
    nameMm: "",
    displayOrder: 0,
    isActive: true,
  });
  const [loading, setLoading] = useState(false);

  const isOpen = state !== null;

  const isEdit = state?.mode === "edit";

  useEffect(() => {
    if (state?.mode === "edit") {
      const category = state.category;
      setFormState({
        nameEn: category.nameEn,
        nameMm: category.nameMm ?? "",
        displayOrder: category.displayOrder,
        isActive: category.isActive,
      });
    } else if (state?.mode === "create") {
      setFormState({
        nameEn: "",
        nameMm: "",
        displayOrder: 0,
        isActive: true,
      });
    }
  }, [state]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        nameEn: formState.nameEn.trim(),
        nameMm: formState.nameMm.trim() || undefined,
        displayOrder: Number.isFinite(formState.displayOrder)
          ? formState.displayOrder
          : 0,
        isActive: formState.isActive,
      });
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save category"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit category" : "Create category"}
          </DialogTitle>
          <DialogDescription>
            Provide localized labels and control visibility for this category.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              English name
            </label>
            <Input
              value={formState.nameEn}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  nameEn: event.target.value,
                }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Burmese name
            </label>
            <Input
              value={formState.nameMm}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  nameMm: event.target.value,
                }))
              }
              placeholder="Optional"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Display order
              </label>
              <Input
                type="number"
                value={formState.displayOrder}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    displayOrder: Number(event.target.value),
                  }))
                }
                min={0}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Visibility
              </label>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                value={formState.isActive ? "true" : "false"}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    isActive: event.target.value === "true",
                  }))
                }
              >
                <option value="true">Active</option>
                <option value="false">Hidden</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type ItemDialogProps = {
  state: ItemDialogState;
  onClose: () => void;
  onSubmit: (
    categoryId: string,
    values: {
      nameEn: string;
      nameMm?: string;
      descriptionEn?: string;
      descriptionMm?: string;
      placeholderIcon?: string;
      price: number;
      isAvailable?: boolean;
      allowUserNotes?: boolean;
      displayOrder?: number;
    }
  ) => Promise<void>;
};

function ItemDialog({ state, onClose, onSubmit }: ItemDialogProps) {
  const [formState, setFormState] = useState({
    nameEn: "",
    nameMm: "",
    descriptionEn: "",
    descriptionMm: "",
    placeholderIcon: "",
    price: 0,
    isAvailable: true,
    allowUserNotes: false,
    displayOrder: 0,
  });
  const [loading, setLoading] = useState(false);

  const isOpen = state !== null;
  const isEdit = state?.mode === "edit";

  useEffect(() => {
    if (state?.mode === "edit") {
      const item = state.item;
      setFormState({
        nameEn: item.nameEn,
        nameMm: item.nameMm ?? "",
        descriptionEn: item.descriptionEn ?? "",
        descriptionMm: item.descriptionMm ?? "",
        placeholderIcon: item.placeholderIcon ?? "",
        price: item.price,
        isAvailable: item.isAvailable,
        allowUserNotes: item.allowUserNotes,
        displayOrder: item.displayOrder,
      });
    } else if (state?.mode === "create") {
      setFormState({
        nameEn: "",
        nameMm: "",
        descriptionEn: "",
        descriptionMm: "",
        placeholderIcon: "",
        price: 0,
        isAvailable: true,
        allowUserNotes: false,
        displayOrder: 0,
      });
    }
  }, [state]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!state) return;

    setLoading(true);
    try {
      await onSubmit(state.categoryId, {
        nameEn: formState.nameEn.trim(),
        nameMm: formState.nameMm.trim() || undefined,
        descriptionEn: formState.descriptionEn.trim() || undefined,
        descriptionMm: formState.descriptionMm.trim() || undefined,
        placeholderIcon: formState.placeholderIcon.trim() || undefined,
        price: Number(formState.price),
        isAvailable: formState.isAvailable,
        allowUserNotes: formState.allowUserNotes,
        displayOrder: Number.isFinite(formState.displayOrder)
          ? formState.displayOrder
          : 0,
      });
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save menu item"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit menu item" : "Add menu item"}</DialogTitle>
          <DialogDescription>
            Configure pricing, notes, and availability. Choice groups can be added after saving.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                English name
              </label>
              <Input
                value={formState.nameEn}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    nameEn: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Burmese name
              </label>
              <Input
                value={formState.nameMm}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    nameMm: event.target.value,
                  }))
                }
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Base price (THB)
              </label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={formState.price}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    price: Number(event.target.value),
                  }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Placeholder icon
              </label>
              <Input
                value={formState.placeholderIcon}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    placeholderIcon: event.target.value,
                  }))
                }
                placeholder="Optional emoji or icon reference"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                English description
              </label>
              <Textarea
                value={formState.descriptionEn}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    descriptionEn: event.target.value,
                  }))
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Burmese description
              </label>
              <Textarea
                value={formState.descriptionMm}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    descriptionMm: event.target.value,
                  }))
                }
                rows={3}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Display order
              </label>
              <Input
                type="number"
                min={0}
                value={formState.displayOrder}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    displayOrder: Number(event.target.value),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Visibility
              </label>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                value={formState.isAvailable ? "true" : "false"}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    isAvailable: event.target.value === "true",
                  }))
                }
              >
                <option value="true">Available</option>
                <option value="false">Hidden</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="allow-notes"
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              checked={formState.allowUserNotes}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  allowUserNotes: event.target.checked,
                }))
              }
            />
            <label htmlFor="allow-notes" className="text-sm text-slate-700">
              Allow customer notes
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type GroupDialogProps = {
  state: GroupDialogState;
  onClose: () => void;
  onSubmit: (
    menuItemId: string,
    values: {
      titleEn: string;
      titleMm?: string;
      minSelect: number;
      maxSelect: number;
      isRequired?: boolean;
      displayOrder?: number;
    }
  ) => Promise<void>;
};

function GroupDialog({ state, onClose, onSubmit }: GroupDialogProps) {
  const [formState, setFormState] = useState({
    titleEn: "",
    titleMm: "",
    minSelect: 0,
    maxSelect: 1,
    isRequired: false,
    displayOrder: 0,
  });
  const [loading, setLoading] = useState(false);

  const isOpen = state !== null;
  const isEdit = state?.mode === "edit";

  useEffect(() => {
    if (state?.mode === "edit") {
      const group = state.group;
      setFormState({
        titleEn: group.titleEn,
        titleMm: group.titleMm ?? "",
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        isRequired: group.isRequired,
        displayOrder: group.displayOrder,
      });
    } else if (state?.mode === "create") {
      setFormState({
        titleEn: "",
        titleMm: "",
        minSelect: 0,
        maxSelect: 1,
        isRequired: false,
        displayOrder: 0,
      });
    }
  }, [state]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!state) return;

    if (formState.maxSelect < formState.minSelect) {
      toast.error("Max select must be greater than or equal to min select");
      return;
    }

    setLoading(true);
    try {
      await onSubmit(state.menuItemId, {
        titleEn: formState.titleEn.trim(),
        titleMm: formState.titleMm.trim() || undefined,
        minSelect: Number(formState.minSelect),
        maxSelect: Number(formState.maxSelect),
        isRequired: formState.isRequired,
        displayOrder: Number.isFinite(formState.displayOrder)
          ? formState.displayOrder
          : 0,
      });
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save choice group"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit choice group" : "Add choice group"}
          </DialogTitle>
          <DialogDescription>
            Define how many options customers can pick for this group.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              English title
            </label>
            <Input
              value={formState.titleEn}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  titleEn: event.target.value,
                }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Burmese title
            </label>
            <Input
              value={formState.titleMm}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  titleMm: event.target.value,
                }))
              }
              placeholder="Optional"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Min select
              </label>
              <Input
                type="number"
                min={0}
                value={formState.minSelect}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    minSelect: Number(event.target.value),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Max select
              </label>
              <Input
                type="number"
                min={1}
                value={formState.maxSelect}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    maxSelect: Number(event.target.value),
                  }))
                }
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Display order
              </label>
              <Input
                type="number"
                min={0}
                value={formState.displayOrder}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    displayOrder: Number(event.target.value),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Requirement
              </label>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                value={formState.isRequired ? "true" : "false"}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    isRequired: event.target.value === "true",
                  }))
                }
              >
                <option value="false">Optional</option>
                <option value="true">Required</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type OptionDialogProps = {
  state: OptionDialogState;
  onClose: () => void;
  onSubmit: (
    choiceGroupId: string,
    values: {
      nameEn: string;
      nameMm?: string;
      extraPrice: number;
      isAvailable?: boolean;
      displayOrder?: number;
    }
  ) => Promise<void>;
};

function OptionDialog({ state, onClose, onSubmit }: OptionDialogProps) {
  const [formState, setFormState] = useState({
    nameEn: "",
    nameMm: "",
    extraPrice: 0,
    isAvailable: true,
    displayOrder: 0,
  });
  const [loading, setLoading] = useState(false);

  const isOpen = state !== null;
  const isEdit = state?.mode === "edit";

  useEffect(() => {
    if (state?.mode === "edit") {
      const option = state.option;
      setFormState({
        nameEn: option.nameEn,
        nameMm: option.nameMm ?? "",
        extraPrice: option.extraPrice,
        isAvailable: option.isAvailable,
        displayOrder: option.displayOrder,
      });
    } else if (state?.mode === "create") {
      setFormState({
        nameEn: "",
        nameMm: "",
        extraPrice: 0,
        isAvailable: true,
        displayOrder: 0,
      });
    }
  }, [state]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!state) return;

    setLoading(true);
    try {
      await onSubmit(state.choiceGroupId, {
        nameEn: formState.nameEn.trim(),
        nameMm: formState.nameMm.trim() || undefined,
        extraPrice: Number(formState.extraPrice),
        isAvailable: formState.isAvailable,
        displayOrder: Number.isFinite(formState.displayOrder)
          ? formState.displayOrder
          : 0,
      });
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save choice option"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit option" : "Add option"}
          </DialogTitle>
          <DialogDescription>
            Extra price is in THB and will be added to the base price.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              English name
            </label>
            <Input
              value={formState.nameEn}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  nameEn: event.target.value,
                }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Burmese name
            </label>
            <Input
              value={formState.nameMm}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  nameMm: event.target.value,
                }))
              }
              placeholder="Optional"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Extra price (THB)
              </label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={formState.extraPrice}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    extraPrice: Number(event.target.value),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Availability
              </label>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                value={formState.isAvailable ? "true" : "false"}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    isAvailable: event.target.value === "true",
                  }))
                }
              >
                <option value="true">Available</option>
                <option value="false">Hidden</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Display order
            </label>
            <Input
              type="number"
              min={0}
              value={formState.displayOrder}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  displayOrder: Number(event.target.value),
                }))
              }
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type ImageDialogProps = {
  state: ImageDialogState;
  onClose: () => void;
  onUpload: (itemId: string, file: File) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
};

function ImageDialog({
  state,
  onClose,
  onUpload,
  onDelete,
  fileInputRef,
}: ImageDialogProps) {
  const [loading, setLoading] = useState(false);
  const isOpen = state !== null;
  const item = state?.item;

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!item || !file) return;
    setLoading(true);
    try {
      await onUpload(item.id, file);
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Image upload failed"
      );
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = async () => {
    if (!item) return;
    setLoading(true);
    try {
      await onDelete(item.id);
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to remove image"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage image</DialogTitle>
          <DialogDescription>
            Upload a new hero image for this menu item. Images are cached aggressively, so replacing them generates a new URL automatically.
          </DialogDescription>
        </DialogHeader>
        {item && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p>
                Current status:{" "}
                <strong className="font-semibold text-slate-900">
                  {item.hasImage ? "Image in use" : "No image"}
                </strong>
              </p>
              {item.imageUrl && (
                <a
                  href={item.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  Preview current image →
                </a>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                {loading ? "Uploading..." : "Select image"}
              </Button>
              {item.hasImage && (
                <Button
                  variant="ghost"
                  onClick={handleRemove}
                  disabled={loading}
                >
                  Remove image
                </Button>
              )}
            </div>
            <p className="text-xs text-slate-500">
              PNG, JPEG, or WebP up to 8MB. Files are lightly optimized before upload.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
