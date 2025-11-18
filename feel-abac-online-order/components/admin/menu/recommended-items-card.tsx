"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Loader2Icon,
  PlusCircleIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { defaultHeaders, fetchJSON } from "./api-client";
import {
  AdminRecommendedMenuItem,
  MenuCategoryRecord,
} from "@/lib/menu/types";

type RecommendationDraft = AdminRecommendedMenuItem & {
  badgeDraft: string;
};

type RecommendedItemsCardProps = {
  menu: MenuCategoryRecord[];
  initialRecommendations: AdminRecommendedMenuItem[];
};

export function RecommendedItemsCard({
  menu,
  initialRecommendations,
}: RecommendedItemsCardProps) {
  const [recommendations, setRecommendations] = useState<RecommendationDraft[]>(
    () => mapToDrafts(initialRecommendations)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderDirty, setOrderDirty] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categorySelection, setCategorySelection] = useState<string>("");
  const [itemSelection, setItemSelection] = useState<string>("");
  const [badgeInput, setBadgeInput] = useState("");

  useEffect(() => {
    setRecommendations(mapToDrafts(initialRecommendations));
    setOrderDirty(false);
  }, [initialRecommendations]);

  const categoryOptions = useMemo(() => {
    return menu
      .filter((category) => category.items.length > 0)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [menu]);

  useEffect(() => {
    if (!dialogOpen) {
      setCategorySelection("");
      setItemSelection("");
      setBadgeInput("");
      return;
    }

    if (!categorySelection && categoryOptions.length > 0) {
      const [first] = categoryOptions;
      setCategorySelection(first.id);
      setItemSelection(first.items[0]?.id ?? "");
    }
  }, [categoryOptions, categorySelection, dialogOpen]);

  const selectedCategory = useMemo(() => {
    if (!categorySelection) return null;
    return categoryOptions.find((category) => category.id === categorySelection) ?? null;
  }, [categoryOptions, categorySelection]);

  const selectedItems = selectedCategory
    ? selectedCategory.items.slice().sort((a, b) => a.displayOrder - b.displayOrder)
    : [];

  const refreshRecommendations = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchJSON<{ recommendations: AdminRecommendedMenuItem[] }>(
        "/api/admin/menu/recommended",
        { method: "GET", cache: "no-store" }
      );
      setRecommendations(mapToDrafts(data.recommendations ?? []));
      setOrderDirty(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load recommendations");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleAddRecommendation = async () => {
    if (!itemSelection) {
      toast.error("Pick an item to feature");
      return;
    }

    setIsSubmitting(true);
    try {
      await fetchJSON("/api/admin/menu/recommended", {
        method: "POST",
        headers: defaultHeaders,
        body: JSON.stringify({
          menuItemId: itemSelection,
          badgeLabel: badgeInput.trim() || undefined,
        }),
      });
      toast.success("Recommendation added");
      setDialogOpen(false);
      await refreshRecommendations();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Could not add item");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveRecommendation = async (id: string) => {
    if (!window.confirm("Remove this item from the recommended section?")) {
      return;
    }

    try {
      await fetchJSON(`/api/admin/menu/recommended/${id}`, {
        method: "DELETE",
        headers: defaultHeaders,
      });
      toast.success("Recommendation removed");
      await refreshRecommendations();
    } catch (error) {
      console.error(error);
      toast.error("Could not remove recommendation");
    }
  };

  const handleBadgeSave = async (id: string, value: string) => {
    try {
      await fetchJSON(`/api/admin/menu/recommended/${id}`, {
        method: "PATCH",
        headers: defaultHeaders,
        body: JSON.stringify({
          badgeLabel: value.trim(),
        }),
      });
      toast.success("Badge updated");
      await refreshRecommendations();
    } catch (error) {
      console.error(error);
      toast.error("Could not update badge");
    }
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= recommendations.length) {
      return;
    }
    setRecommendations((prev) => {
      const updated = [...prev];
      const [removed] = updated.splice(index, 1);
      updated.splice(nextIndex, 0, removed);
      return updated;
    });
    setOrderDirty(true);
  };

  const handleApplyOrder = async () => {
    if (recommendations.length < 2) {
      return;
    }
    setIsSavingOrder(true);
    try {
      await fetchJSON("/api/admin/menu/recommended/reorder", {
        method: "POST",
        headers: defaultHeaders,
        body: JSON.stringify({
          items: recommendations.map((entry, index) => ({
            id: entry.id,
            displayOrder: index,
          })),
        }),
      });
      toast.success("Recommendation order updated");
      await refreshRecommendations();
    } catch (error) {
      console.error(error);
      toast.error("Could not save order");
    } finally {
      setIsSavingOrder(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-1.5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900">
              Spotlight & recommendations
            </CardTitle>
            <CardDescription>
              Choose which dishes appear in the recommended carousel above the menu.
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                disabled={categoryOptions.length === 0}
              >
                <PlusCircleIcon className="size-4" />
                Add recommended menu items
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add menu item</DialogTitle>
                <DialogDescription>
                  Pick a category, then choose an existing dish to feature. Dupes are automatically prevented.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Category
                  </label>
                  <Select
                    value={categorySelection}
                    onValueChange={(value) => {
                      setCategorySelection(value);
                      const selected = menu.find((cat) => cat.id === value);
                      setItemSelection(selected?.items[0]?.id ?? "");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.nameEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Menu item
                  </label>
                  <Select
                    value={itemSelection}
                    onValueChange={setItemSelection}
                    disabled={selectedItems.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select menu item" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.nameEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Badge label (optional)
                  </label>
                  <Input
                    value={badgeInput}
                    onChange={(event) => setBadgeInput(event.target.value)}
                    placeholder="Chef's pick"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleAddRecommendation()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2Icon className="mr-2 size-4 animate-spin" />
                  ) : null}
                  Add
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            <Loader2Icon className="size-4 animate-spin text-emerald-500" />
            Refreshing recommendations…
          </div>
        ) : recommendations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            Nothing featured yet. Add a dish to show the recommended section at the top of the menu.
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((entry, index) => (
              <div
                key={entry.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {entry.item.nameEn}
                    </p>
                    <p className="text-xs text-slate-500">
                      {entry.category.nameEn}
                    </p>
                    <p className="text-xs text-slate-500">
                      ฿{entry.item.price.toFixed(2)} ·{" "}
                      {entry.item.isAvailable ? "Available" : "Out of stock"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleMove(index, "up")}
                      disabled={index === 0}
                    >
                      <ArrowUpIcon className="size-4" />
                      <span className="sr-only">Move up</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleMove(index, "down")}
                      disabled={index === recommendations.length - 1}
                    >
                      <ArrowDownIcon className="size-4" />
                      <span className="sr-only">Move down</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-rose-600 hover:text-rose-700"
                      onClick={() => void handleRemoveRecommendation(entry.id)}
                    >
                      <Trash2Icon className="mr-1 size-4" />
                      Remove
                    </Button>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 sm:w-32">
                    Badge label
                  </label>
                  <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      value={entry.badgeDraft}
                      onChange={(event) =>
                        setRecommendations((prev) =>
                          prev.map((rec) =>
                            rec.id === entry.id
                              ? { ...rec, badgeDraft: event.target.value }
                              : rec
                          )
                        )
                      }
                      placeholder="Chef's pick"
                      className="sm:flex-1"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void handleBadgeSave(entry.id, entry.badgeDraft)}
                    >
                      Save badge
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {orderDirty && recommendations.length > 0 ? (
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => void handleApplyOrder()}
              disabled={isSavingOrder}
            >
              {isSavingOrder ? (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              ) : null}
              Save order
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function mapToDrafts(
  records: AdminRecommendedMenuItem[]
): RecommendationDraft[] {
  return records.map((record) => ({
    ...record,
    badgeDraft: record.badgeLabel ?? "",
  }));
}
