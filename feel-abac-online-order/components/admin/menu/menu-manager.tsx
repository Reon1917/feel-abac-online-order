"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  Loader2Icon,
  PlusCircleIcon,
  RefreshCwIcon,
} from "lucide-react";
import {
  MenuCategoryRecord,
  MenuItemRecord,
} from "@/lib/menu/types";
import { MenuEditor } from "./menu-editor";
import { useAdminMenuStore } from "./store";
import { fetchJSON, defaultHeaders } from "./api-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type AdminMenuManagerProps = {
  initialMenu: MenuCategoryRecord[];
  variant?: "standalone" | "workspace";
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

type CategoryDialogState =
  | { mode: "create" }
  | { mode: "edit"; category: MenuCategoryRecord }
  | null;

function nextDisplayOrder(records: { displayOrder: number }[]) {
  if (records.length === 0) return 0;
  return Math.max(...records.map((record) => record.displayOrder ?? 0)) + 1;
}

export function AdminMenuManager({ initialMenu, variant = "standalone" }: AdminMenuManagerProps) {
  const router = useRouter();
  const menu = useAdminMenuStore((state) => state.menu);
  const selectedCategoryId = useAdminMenuStore((state) => state.selectedCategoryId);
  const selectedItemId = useAdminMenuStore((state) => state.selectedItemId);
  const isRefreshing = useAdminMenuStore((state) => state.isRefreshing);
  const setMenuStore = useAdminMenuStore((state) => state.setMenu);
  const setSelectedCategory = useAdminMenuStore((state) => state.setSelectedCategory);
  const setSelectedItem = useAdminMenuStore((state) => state.setSelectedItem);
  const setIsRefreshing = useAdminMenuStore((state) => state.setIsRefreshing);

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

  useEffect(() => {
    setMenuStore(initialMenu);
  }, [initialMenu, setMenuStore]);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const refreshMenu = useCallback(
    async (opts?: { categoryId?: string | null; itemId?: string | null }) => {
      setIsRefreshing(true);
      try {
        const data = await fetchJSON<{ menu: MenuCategoryRecord[] }>(
          "/api/admin/menu/tree",
          { method: "GET", cache: "no-store" }
        );
        setMenuStore(data.menu ?? []);
        if (opts?.categoryId !== undefined) {
          setSelectedCategory(opts.categoryId);
        }
        if (opts?.itemId !== undefined) {
          setSelectedItem(opts.itemId);
        }
      } catch (error) {
        console.error(error);
        toast.error(
          error instanceof Error ? error.message : "Failed to refresh menu"
        );
      } finally {
        setIsRefreshing(false);
      }
    },
    [setIsRefreshing, setMenuStore, setSelectedCategory, setSelectedItem]
  );

  const handleCreateDraftItem = useCallback(async () => {
    if (!selectedCategory) {
      toast.error("Select a category first.");
      return;
    }
    try {
      const displayOrder = nextDisplayOrder(selectedCategory.items);
      const { item } = await fetchJSON<{ item: MenuItemRecord }>(
        "/api/admin/menu/items",
        {
          method: "POST",
          headers: defaultHeaders,
          body: JSON.stringify({
            categoryId: selectedCategory.id,
            nameEn: "Untitled item",
            price: 0,
            status: "draft",
            isAvailable: false,
            allowUserNotes: false,
            displayOrder,
          }),
        }
      );
      toast.success("Draft menu item created");
      await refreshMenu({
        categoryId: selectedCategory.id,
        itemId: item.id,
      });
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create menu item"
      );
    }
  }, [refreshMenu, selectedCategory]);

  const handleCreateCategory = useCallback(
    async (input: { nameEn: string; nameMm?: string; isActive: boolean }) => {
      try {
        const displayOrder = nextDisplayOrder(menu);
        await fetchJSON<{ category: MenuCategoryRecord }>(
          "/api/admin/menu/categories",
          {
            method: "POST",
            headers: defaultHeaders,
            body: JSON.stringify({
              ...input,
              displayOrder,
            }),
          }
        );
        toast.success("Category created");
        await refreshMenu();
      } catch (error) {
        console.error(error);
        toast.error(
          error instanceof Error ? error.message : "Failed to create category"
        );
      }
    },
    [menu, refreshMenu]
  );

  const handleUpdateCategory = useCallback(
    async (
      categoryId: string,
      updates: Partial<{ nameEn: string; nameMm?: string; isActive: boolean }>
    ) => {
      try {
        await fetchJSON<{ category: MenuCategoryRecord }>(
          `/api/admin/menu/categories/${categoryId}`,
          {
            method: "PATCH",
            headers: defaultHeaders,
            body: JSON.stringify(updates),
          }
        );
        toast.success("Category updated");
        await refreshMenu({ categoryId });
      } catch (error) {
        console.error(error);
        toast.error(
          error instanceof Error ? error.message : "Failed to update category"
        );
      }
    },
    [refreshMenu]
  );

  const handleDeleteCategory = useCallback(
    async (categoryId: string) => {
      if (
        !window.confirm(
          "Deleting this category will remove all items under it. Continue?"
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
    },
    [refreshMenu]
  );

  const handleBackToDashboard = () => {
    if (hasUnsavedChanges) {
      setExitDialogOpen(true);
      return;
    }
    router.push("/admin/dashboard");
  };

  const handleDiscardAndLeave = () => {
    setExitDialogOpen(false);
    setHasUnsavedChanges(false);
    router.push("/admin/dashboard");
  };

  const handleSaveDraftAndLeave = async () => {
    if (!selectedItem) {
      handleDiscardAndLeave();
      return;
    }
    setIsSavingDraft(true);
    try {
      await fetchJSON<{ item: MenuItemRecord }>(
        `/api/admin/menu/items/${selectedItem.id}`,
        {
          method: "PATCH",
          headers: defaultHeaders,
          body: JSON.stringify({ status: "draft" }),
        }
      );
      await refreshMenu({
        categoryId: selectedCategory?.id ?? null,
        itemId: selectedItem.id,
      });
      setHasUnsavedChanges(false);
      setExitDialogOpen(false);
      router.push("/admin/dashboard");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Unable to save draft"
      );
    } finally {
      setIsSavingDraft(false);
    }
  };

  const subtleActionClasses =
    "border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800";
  const primaryActionClasses =
    "border border-emerald-600 bg-emerald-600 text-white shadow-sm hover:bg-emerald-500";
  const switchToneClasses =
    "data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-slate-200";

  const headerBadgeLabel = variant === "standalone" ? "Menu studio" : "Workspace controls";
  const headerTitle = variant === "standalone" ? "Craft your digital lineup" : "Menu workspace";
  const headerSubtitle =
    variant === "standalone"
      ? "Everything autosaves as you go—no more lost work. Preview changes instantly and publish when you’re ready."
      : "Organize categories, curate dishes, and adjust availability without leaving this workspace. Autosave keeps drafts safe while you experiment.";

  const headerContent = (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          {headerBadgeLabel}
        </span>
        <h2
          className={cn(
            "font-semibold text-slate-900",
            variant === "standalone" ? "text-3xl" : "text-2xl"
          )}
        >
          {headerTitle}
        </h2>
        <p className="text-sm text-slate-600">{headerSubtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          type="button"
          onClick={handleBackToDashboard}
          className={subtleActionClasses}
        >
          <ArrowLeftIcon className="size-4" />
          Back to dashboard
        </Button>
        <Button
          variant="default"
          type="button"
          onClick={() => void refreshMenu()}
          disabled={isRefreshing}
          className={primaryActionClasses}
        >
          {isRefreshing ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <RefreshCwIcon className="size-4" />
          )}
          Refresh
        </Button>
      </div>
    </div>
  );

  const gridContent = (
  <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <CategoryPanel
        menu={menu}
        selectedCategoryId={selectedCategoryId}
        selectedItemId={selectedItemId}
        onSelectCategory={(categoryId) => setSelectedCategory(categoryId)}
        onSelectItem={(itemId) => setSelectedItem(itemId)}
        onCreateDraftItem={handleCreateDraftItem}
        onCreateCategory={handleCreateCategory}
        onUpdateCategory={handleUpdateCategory}
        onDeleteCategory={handleDeleteCategory}
        primaryActionClassName={primaryActionClasses}
        subtleActionClassName={subtleActionClasses}
        switchToneClassName={switchToneClasses}
      />

      <MenuEditor
        refreshMenu={refreshMenu}
        onDirtyChange={setHasUnsavedChanges}
      />
    </div>
  );

  const layout =
    variant === "workspace" ? (
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
        <div className="border-b border-slate-200 bg-linear-to-br from-white via-white to-emerald-50/80 p-6">
          {headerContent}
        </div>
        <div className="p-6">{gridContent}</div>
      </section>
    ) : (
      <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-6">
        {headerContent}
        {gridContent}
      </div>
    );

  return (
    <>
      {layout}
      <Dialog open={exitDialogOpen} onOpenChange={setExitDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Unsaved changes</DialogTitle>
            <DialogDescription>
              You have changes that are still syncing. Save as draft before leaving or stay on this page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              type="button"
              onClick={() => setExitDialogOpen(false)}
              className={subtleActionClasses}
            >
              Stay here
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={handleDiscardAndLeave}
              className="border-rose-200 text-rose-600 hover:bg-rose-50"
            >
              Discard and leave
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveDraftAndLeave()}
              disabled={isSavingDraft}
              className={primaryActionClasses}
            >
              {isSavingDraft ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : null}
              Save draft & exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type CategoryPanelProps = {
  menu: MenuCategoryRecord[];
  selectedCategoryId: string | null;
  selectedItemId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  onSelectItem: (itemId: string | null) => void;
  onCreateDraftItem: () => Promise<void>;
  onCreateCategory: (values: {
    nameEn: string;
    nameMm?: string;
    isActive: boolean;
  }) => Promise<void>;
  onUpdateCategory: (
    categoryId: string,
    updates: Partial<{ nameEn: string; nameMm?: string; isActive: boolean }>
  ) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
  primaryActionClassName: string;
  subtleActionClassName: string;
  switchToneClassName: string;
};

function CategoryPanel({
  menu,
  selectedCategoryId,
  selectedItemId,
  onSelectCategory,
  onSelectItem,
  onCreateDraftItem,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  primaryActionClassName,
  subtleActionClassName,
  switchToneClassName,
}: CategoryPanelProps) {
  const [dialogState, setDialogState] = useState<CategoryDialogState>(null);
  const [nameEn, setNameEn] = useState("");
  const [nameMm, setNameMm] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedCategory = useMemo(() => {
    if (!selectedCategoryId) return null;
    return menu.find((category) => category.id === selectedCategoryId) ?? null;
  }, [menu, selectedCategoryId]);

  useEffect(() => {
    if (!dialogState) {
      setNameEn("");
      setNameMm("");
      setIsActive(true);
      return;
    }
    if (dialogState.mode === "edit") {
      setNameEn(dialogState.category.nameEn);
      setNameMm(dialogState.category.nameMm ?? "");
      setIsActive(dialogState.category.isActive);
    } else {
      setNameEn("");
      setNameMm("");
      setIsActive(true);
    }
  }, [dialogState]);

  const handleSubmitCategory = async () => {
    if (!nameEn.trim()) {
      toast.error("English name is required.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (dialogState?.mode === "edit") {
        await onUpdateCategory(dialogState.category.id, {
          nameEn: nameEn.trim(),
          nameMm: nameMm.trim() || undefined,
          isActive,
        });
      } else {
        await onCreateCategory({
          nameEn: nameEn.trim(),
          nameMm: nameMm.trim() || undefined,
          isActive,
        });
      }
      setDialogState(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-slate-900">
            Step 1 · Pick a category
          </CardTitle>
          <CardDescription className="text-sm text-slate-600">
            Categories keep your menu tidy. Choose one to see its dishes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={() => setDialogState({ mode: "create" })}
              className={primaryActionClassName}
            >
              <PlusCircleIcon className="size-4" />
              Create category
            </Button>
          </div>
          {menu.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              No categories yet. Create one to begin building your menu.
            </div>
          ) : (
            <div className="space-y-3">
              {menu.map((category) => {
                const isSelected = category.id === selectedCategoryId;
                return (
                  <div
                    key={category.id}
                    className={cn(
                      "rounded-lg border p-3 transition hover:border-emerald-300",
                      isSelected
                        ? "border-emerald-400 bg-emerald-50 shadow-sm"
                        : "border-slate-200 bg-white"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectCategory(category.id)}
                      className="w-full text-left"
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
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            category.isActive
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-600"
                          )}
                        >
                          {category.isActive ? "Active" : "Hidden"}
                        </span>
                      </div>
                    </button>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span>{category.items.length} items</span>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-600">
                            Visible
                          </span>
                          <Switch
                            checked={category.isActive}
                            onCheckedChange={(checked) =>
                              onUpdateCategory(category.id, {
                                isActive: checked,
                              })
                            }
                            className={switchToneClassName}
                          />
                        </div>
                        <button
                          type="button"
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                          onClick={() => setDialogState({ mode: "edit", category })}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                          onClick={() => void onDeleteCategory(category.id)}
                        >
                          Delete category
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-slate-900">
            Step 2 · Add dishes & drinks
          </CardTitle>
          <CardDescription className="text-sm text-slate-600">
            {selectedCategory
              ? `You're working inside ${selectedCategory.nameEn}. Pick an existing item or add something new.`
              : "Choose a category first, then start adding dishes and drinks here."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              type="button"
              onClick={() => void onCreateDraftItem()}
              disabled={!selectedCategory}
              className={primaryActionClassName}
            >
              <PlusCircleIcon className="size-4" />
              Add menu item
            </Button>
          </div>
          {selectedCategory ? (
            selectedCategory.items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                No items yet. Click “Add menu item” to start filling this category.
              </div>
            ) : (
              <div className="space-y-2">
                {selectedCategory.items.map((item) => {
                  const isActive = item.id === selectedItemId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectItem(item.id)}
                      className={cn(
                        "w-full rounded-lg border px-3 py-2 text-left transition hover:border-emerald-300",
                        isActive
                          ? "border-emerald-400 bg-emerald-50 shadow-sm"
                          : "border-slate-200 bg-white"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {item.nameEn}
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.descriptionEn
                              ? item.descriptionEn.slice(0, 60)
                              : "No description yet"}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-semibold text-slate-600">
                            {item.status === "published" ? "Live" : "Draft"}
                          </span>
                          <div className="text-xs text-slate-500">
                            {formatMoney(item.price)}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              Choose a category above to see its items.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogState !== null} onOpenChange={(open) => !open && setDialogState(null)}>
        <DialogContent className="max-w-md bg-white text-slate-900">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-900">
              {dialogState?.mode === "edit" ? "Edit category" : "Create category"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              Give the category a clear name so diners find what they want fast.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              English name
              <Input
                value={nameEn}
                onChange={(event) => setNameEn(event.target.value)}
                placeholder="e.g. Rice bowls"
                className="border-slate-200 bg-white text-slate-900"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Burmese name
              <Input
                value={nameMm}
                onChange={(event) => setNameMm(event.target.value)}
                placeholder="မြန်မာလို အမည်"
                className="border-slate-200 bg-white text-slate-900"
              />
            </label>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="text-sm font-medium text-slate-700">
                Visible to diners
              </span>
              <Switch
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(checked)}
                className={switchToneClassName}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => setDialogState(null)}
              className={subtleActionClassName}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmitCategory()}
              disabled={isSubmitting}
              className={primaryActionClassName}
            >
              {isSubmitting ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
