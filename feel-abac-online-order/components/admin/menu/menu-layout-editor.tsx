"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { toast } from "sonner";
import {
  GripVerticalIcon,
  Loader2Icon,
  RefreshCwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  MenuCategoryRecord,
  MenuItemRecord,
} from "@/lib/menu/types";
import { fetchJSON, applyMenuReorder } from "./api-client";

type LayoutEditorLabels = {
  title: string;
  subtitle: string;
  backToBuilder: string;
  modeLabel: string;
  modes: {
    categories: string;
    items: string;
  };
  stats: {
    categories: string;
    items: string;
  };
  status: {
    clean: string;
    dirty: string;
  };
  categorySelectLabel: string;
  categorySelectPlaceholder: string;
  refreshLabel: string;
  emptyCategories: {
    title: string;
    description: string;
  };
  emptyItems: {
    title: string;
    description: string;
  };
  dropHint: string;
  actions: {
    apply: string;
    reset: string;
  };
  feedback: {
    success: string;
    nothingToApply: string;
    apiError: string;
    confirmTitle: string;
    confirmDescription: string;
    discard: string;
    stay: string;
  };
  badges: {
    hidden: string;
    draft: string;
    unavailable: string;
  };
};

type MenuLayoutEditorProps = {
  initialMenu: MenuCategoryRecord[];
  labels: LayoutEditorLabels;
};

type Mode = "categories" | "items";

type ConfirmState =
  | { type: "mode"; nextMode: Mode }
  | { type: "category"; nextCategoryId: string };

type ItemOrderMap = Record<string, string[]>;

export function MenuLayoutEditor({ initialMenu, labels }: MenuLayoutEditorProps) {
  const [menu, setMenu] = useState<MenuCategoryRecord[]>(initialMenu);
  const [mode, setMode] = useState<Mode>("categories");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    initialMenu[0]?.id ?? null
  );
  const [categoryOrder, setCategoryOrder] = useState<string[]>(() =>
    sortCategories(initialMenu)
  );
  const [itemOrders, setItemOrders] = useState<ItemOrderMap>(() =>
    buildItemOrders(initialMenu)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmState | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      pressDelay: 120,
      activationConstraint: { distance: 8 },
    })
  );

  const categoryMap = useMemo(() => {
    return new Map(menu.map((category) => [category.id, category]));
  }, [menu]);

  const itemMap = useMemo(() => {
    const map = new Map<
      string,
      { item: MenuItemRecord; categoryId: string }
    >();
    menu.forEach((category) => {
      category.items.forEach((item) => {
        map.set(item.id, { item, categoryId: category.id });
      });
    });
    return map;
  }, [menu]);

  const selectedCategory = selectedCategoryId
    ? categoryMap.get(selectedCategoryId) ?? null
    : null;

  const hydrateState = useCallback((nextMenu: MenuCategoryRecord[]) => {
    setMenu(nextMenu);
    setCategoryOrder(sortCategories(nextMenu));
    setItemOrders(buildItemOrders(nextMenu));
    setSelectedCategoryId((prev) => {
      if (prev && nextMenu.some((category) => category.id === prev)) {
        return prev;
      }
      return nextMenu[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    hydrateState(initialMenu);
  }, [hydrateState, initialMenu]);

  const refreshMenu = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await fetchJSON<{ menu: MenuCategoryRecord[] }>(
        "/api/admin/menu/tree",
        { method: "GET", cache: "no-store" }
      );
      hydrateState(data.menu ?? []);
    } catch (error) {
      console.error(error);
      toast.error(labels.feedback.apiError);
    } finally {
      setIsRefreshing(false);
    }
  }, [hydrateState, labels.feedback.apiError]);

  const categoryChanges = useMemo(() => {
    const baseline = new Map(
      menu.map((category) => [category.id, category.displayOrder])
    );
    return categoryOrder
      .map((id, index) => ({
        id,
        displayOrder: index,
      }))
      .filter((entry) => baseline.get(entry.id) !== entry.displayOrder);
  }, [categoryOrder, menu]);

  const itemChanges = useMemo(() => {
    if (!selectedCategoryId) return [];
    const baselineCategory = menu.find(
      (category) => category.id === selectedCategoryId
    );
    const currentOrder =
      itemOrders[selectedCategoryId] ??
      (baselineCategory ? getItemIds(baselineCategory) : []);
    const baseline = new Map(
      (baselineCategory?.items ?? []).map((item) => [
        item.id,
        item.displayOrder,
      ])
    );
    return currentOrder
      .map((id, index) => ({
        id,
        displayOrder: index,
      }))
      .filter((entry) => baseline.get(entry.id) !== entry.displayOrder);
  }, [itemOrders, menu, selectedCategoryId]);

  const hasPendingChanges =
    mode === "categories"
      ? categoryChanges.length > 0
      : itemChanges.length > 0;

  const pendingCount =
    mode === "categories" ? categoryChanges.length : itemChanges.length;

  const statusLabel = hasPendingChanges
    ? labels.status.dirty.replace("%s", pendingCount.toString())
    : labels.status.clean;

  const categoryRows = categoryOrder
    .map((id) => categoryMap.get(id))
    .filter(Boolean) as MenuCategoryRecord[];

  const currentItemOrder = selectedCategoryId
    ? itemOrders[selectedCategoryId] ??
      (selectedCategory ? getItemIds(selectedCategory) : [])
    : [];

  const itemRows = currentItemOrder
    .map((id) => itemMap.get(id))
    .filter(Boolean)
    .map((entry) => entry?.item) as MenuItemRecord[];

  const listIsEmpty =
    mode === "categories"
      ? categoryRows.length === 0
      : !selectedCategory || itemRows.length === 0;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (mode === "categories") {
      setCategoryOrder((ids) => {
        const oldIndex = ids.indexOf(active.id as string);
        const newIndex = ids.indexOf(over.id as string);
        return arrayMove(ids, oldIndex, newIndex);
      });
    } else if (selectedCategoryId) {
      setItemOrders((prev) => {
        const current = prev[selectedCategoryId] ?? currentItemOrder;
        const oldIndex = current.indexOf(active.id as string);
        const newIndex = current.indexOf(over.id as string);
        return {
          ...prev,
          [selectedCategoryId]: arrayMove(current, oldIndex, newIndex),
        };
      });
    }
  };

  const requestModeChange = (nextMode: Mode) => {
    if (mode === nextMode) return;
    if (hasPendingChanges) {
      setConfirmation({ type: "mode", nextMode });
      return;
    }
    setMode(nextMode);
  };

  const requestCategoryChange = (nextCategoryId: string) => {
    if (selectedCategoryId === nextCategoryId) return;
    if (mode === "items" && hasPendingChanges) {
      setConfirmation({ type: "category", nextCategoryId });
      return;
    }
    setSelectedCategoryId(nextCategoryId);
  };

  const handleReset = () => {
    if (mode === "categories") {
      setCategoryOrder(sortCategories(menu));
    } else if (selectedCategory) {
      setItemOrders((prev) => ({
        ...prev,
        [selectedCategory.id]: getItemIds(selectedCategory),
      }));
    }
  };

  const handleApply = async () => {
    if (mode === "categories") {
      if (categoryRows.length < 2) {
        toast.info(labels.feedback.nothingToApply);
        return;
      }
      if (categoryChanges.length === 0) {
        toast.info(labels.feedback.nothingToApply);
        return;
      }
      setIsSubmitting(true);
      try {
        await applyMenuReorder({
          mode: "categories",
          categories: categoryOrder.map((id, index) => ({
            id,
            displayOrder: index,
          })),
        });
        toast.success(labels.feedback.success);
        await refreshMenu();
      } catch (error) {
        console.error(error);
        toast.error(labels.feedback.apiError);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!selectedCategoryId) {
      toast.info(labels.feedback.nothingToApply);
      return;
    }

    if (currentItemOrder.length < 2 || itemChanges.length === 0) {
      toast.info(labels.feedback.nothingToApply);
      return;
    }

    setIsSubmitting(true);
    try {
      await applyMenuReorder({
        mode: "items",
        categoryId: selectedCategoryId,
        items: currentItemOrder.map((id, index) => ({
          id,
          displayOrder: index,
        })),
      });
      toast.success(labels.feedback.success);
      await refreshMenu();
    } catch (error) {
      console.error(error);
      toast.error(labels.feedback.apiError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDiscardChanges = () => {
    if (mode === "categories") {
      setCategoryOrder(sortCategories(menu));
    } else if (selectedCategoryId) {
      const category = categoryMap.get(selectedCategoryId);
      if (category) {
        setItemOrders((prev) => ({
          ...prev,
          [selectedCategoryId]: getItemIds(category),
        }));
      }
    }

    if (confirmation?.type === "mode") {
      setMode(confirmation.nextMode);
    } else if (confirmation?.type === "category") {
      setSelectedCategoryId(confirmation.nextCategoryId);
    }
    setConfirmation(null);
  };

  return (
    <>
      <Card className="border-slate-200">
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-xl font-semibold text-slate-900">
              {labels.title}
            </CardTitle>
            <CardDescription className="text-sm text-slate-600">
              {labels.subtitle}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {labels.stats.categories}
              </p>
              <p className="text-base font-semibold text-slate-900">
                {menu.length.toLocaleString("en-US")}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {labels.stats.items}
              </p>
              <p className="text-base font-semibold text-slate-900">
                {(
                  (selectedCategory?.items.length ?? 0) || 0
                ).toLocaleString("en-US")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshMenu}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2"
            >
              {isRefreshing ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <RefreshCwIcon className="size-4" />
              )}
              {labels.refreshLabel}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                {labels.modeLabel}
              </p>
              <div className="flex w-full gap-2 rounded-full bg-slate-100 p-1 sm:w-fit">
                <ModeButton
                  active={mode === "categories"}
                  onClick={() => requestModeChange("categories")}
                >
                  {labels.modes.categories}
                </ModeButton>
                <ModeButton
                  active={mode === "items"}
                  onClick={() => requestModeChange("items")}
                  disabled={menu.length === 0}
                >
                  {labels.modes.items}
                </ModeButton>
              </div>
            </div>
            {mode === "items" && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {labels.categorySelectLabel}
                </label>
                <Select
                  value={selectedCategoryId ?? ""}
                  onValueChange={(value) => {
                    requestCategoryChange(value);
                  }}
                  disabled={menu.length === 0}
                >
                  <SelectTrigger className="min-w-[240px]">
                    <SelectValue placeholder={labels.categorySelectPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryRows.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.nameEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/40 px-3 py-2 text-xs text-emerald-900">
            {labels.dropHint}
          </div>

          {listIsEmpty ? (
            <EmptyState
              title={
                mode === "categories"
                  ? labels.emptyCategories.title
                  : labels.emptyItems.title
              }
              description={
                mode === "categories"
                  ? labels.emptyCategories.description
                  : labels.emptyItems.description
              }
            />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <div className="rounded-2xl border border-slate-200 bg-white">
                <SortableContext
                  items={
                    mode === "categories"
                      ? categoryRows.map((category) => category.id)
                      : itemRows.map((item) => item.id)
                  }
                  strategy={verticalListSortingStrategy}
                >
                  {mode === "categories"
                    ? categoryRows.map((category, index) => (
                        <SortableRow
                          key={category.id}
                          id={category.id}
                          index={index}
                          primary={category.nameEn}
                          secondary={category.nameMm}
                          meta={`${category.items.length.toLocaleString(
                            "en-US"
                          )} · ${labels.stats.items}`}
                          badges={
                            category.isActive ? [] : [labels.badges.hidden]
                          }
                        />
                      ))
                    : itemRows.map((item, index) => (
                        <SortableRow
                          key={item.id}
                          id={item.id}
                          index={index}
                          primary={item.nameEn}
                          secondary={item.nameMm ?? undefined}
                          meta={item.menuCode ?? undefined}
                          badges={[
                            ...(!item.isAvailable
                              ? [labels.badges.unavailable]
                              : []),
                            ...(item.status !== "published"
                              ? [labels.badges.draft]
                              : []),
                          ]}
                        />
                      ))}
                </SortableContext>
              </div>
            </DndContext>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-medium text-slate-900">{statusLabel}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="ghost"
                onClick={handleReset}
                disabled={!hasPendingChanges || isSubmitting}
              >
                {labels.actions.reset}
              </Button>
              <Button
                onClick={handleApply}
                disabled={
                  isSubmitting ||
                  !hasPendingChanges ||
                  (mode === "items" &&
                    (!selectedCategoryId || currentItemOrder.length < 2))
                }
                className="bg-emerald-600 text-white hover:bg-emerald-500"
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2Icon className="size-4 animate-spin" />
                    {labels.actions.apply}
                  </span>
                ) : (
                  labels.actions.apply
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmation !== null} onOpenChange={(open) => !open && setConfirmation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{labels.feedback.confirmTitle}</DialogTitle>
            <DialogDescription>{labels.feedback.confirmDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row justify-end gap-3">
            <Button variant="ghost" onClick={() => setConfirmation(null)}>
              {labels.feedback.stay}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDiscardChanges}
            >
              {labels.feedback.discard}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function sortCategories(menu: MenuCategoryRecord[]) {
  return [...menu]
    .sort((a, b) => {
      if (a.displayOrder === b.displayOrder) {
        return a.nameEn.localeCompare(b.nameEn);
      }
      return a.displayOrder - b.displayOrder;
    })
    .map((category) => category.id);
}

function getItemIds(category: MenuCategoryRecord) {
  return [...category.items]
    .sort((a, b) => {
      if (a.displayOrder === b.displayOrder) {
        return a.nameEn.localeCompare(b.nameEn);
      }
      return a.displayOrder - b.displayOrder;
    })
    .map((item) => item.id);
}

function buildItemOrders(menu: MenuCategoryRecord[]): ItemOrderMap {
  return menu.reduce<ItemOrderMap>((acc, category) => {
    acc[category.id] = getItemIds(category);
    return acc;
  }, {});
}

function ModeButton({
  active,
  disabled,
  children,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex-1 rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition",
        active
          ? "bg-white text-slate-900 shadow"
          : "hover:bg-white hover:text-slate-900"
      )}
    >
      {children}
    </Button>
  );
}

function SortableRow({
  id,
  index,
  primary,
  secondary,
  meta,
  badges,
}: {
  id: string;
  index: number;
  primary: string;
  secondary?: string | null;
  meta?: string;
  badges?: string[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style: CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-4 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0",
        isDragging && "z-10 bg-white shadow-lg"
      )}
    >
      <button
        type="button"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 focus:outline-none"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <div className="font-semibold text-slate-900">{primary}</div>
          {badges?.map((badge) => (
            <span
              key={badge}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
            >
              {badge}
            </span>
          ))}
        </div>
        {secondary && (
          <p className="text-xs text-slate-500">{secondary}</p>
        )}
      </div>
      <div className="flex w-32 items-center justify-end text-xs font-mono text-slate-500">
        {meta ?? `#${index + 1}`}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-6 py-10 text-center">
      <p className="text-base font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}
