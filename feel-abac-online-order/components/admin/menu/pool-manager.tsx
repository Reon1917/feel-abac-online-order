"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  GripVerticalIcon,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type ChoicePoolOption = {
  id: string;
  poolId: string;
  menuCode: string | null;
  nameEn: string;
  nameMm: string | null;
  price: number;
  isAvailable: boolean;
  displayOrder: number;
};

type ChoicePool = {
  id: string;
  nameEn: string;
  nameMm: string | null;
  isActive: boolean;
  displayOrder: number;
  options: ChoicePoolOption[];
};

type PoolManagerProps = {
  initialPools: ChoicePool[];
};

type PoolDialogState =
  | { mode: "create" }
  | { mode: "edit"; pool: ChoicePool }
  | null;

type OptionDialogState =
  | { mode: "create"; poolId: string }
  | { mode: "edit"; poolId: string; option: ChoicePoolOption }
  | null;

export function PoolManager({ initialPools }: PoolManagerProps) {
  const router = useRouter();
  const [pools, setPools] = useState<ChoicePool[]>(initialPools);
  const [expandedPools, setExpandedPools] = useState<Set<string>>(new Set());
  const [poolDialog, setPoolDialog] = useState<PoolDialogState>(null);
  const [optionDialog, setOptionDialog] = useState<OptionDialogState>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "pool" | "option";
    id: string;
    poolId?: string;
    name: string;
  } | null>(null);

  const toggleExpanded = useCallback((poolId: string) => {
    setExpandedPools((prev) => {
      const next = new Set(prev);
      if (next.has(poolId)) {
        next.delete(poolId);
      } else {
        next.add(poolId);
      }
      return next;
    });
  }, []);

  // Pool CRUD
  const handleSavePool = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!poolDialog) return;

      setIsSubmitting(true);
      const formData = new FormData(e.currentTarget);
      const data = {
        nameEn: formData.get("nameEn") as string,
        nameMm: (formData.get("nameMm") as string) || undefined,
        isActive: formData.get("isActive") === "on",
      };

      try {
        if (poolDialog.mode === "create") {
          const res = await fetch("/api/admin/menu/pools", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || "Failed to create pool");
          }
          const { pool } = await res.json();
          setPools((prev) => [...prev, { ...pool, options: [] }]);
          toast.success("Pool created");
        } else {
          const res = await fetch(`/api/admin/menu/pools/${poolDialog.pool.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || "Failed to update pool");
          }
          const { pool } = await res.json();
          setPools((prev) =>
            prev.map((p) =>
              p.id === pool.id ? { ...pool, options: p.options } : p
            )
          );
          toast.success("Pool updated");
        }
        setPoolDialog(null);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "An error occurred");
      } finally {
        setIsSubmitting(false);
      }
    },
    [poolDialog, router]
  );

  const handleDeletePool = useCallback(
    async (poolId: string) => {
      setIsSubmitting(true);
      try {
        const res = await fetch(`/api/admin/menu/pools/${poolId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to delete pool");
        }
        setPools((prev) => prev.filter((p) => p.id !== poolId));
        toast.success("Pool deleted");
        setDeleteConfirm(null);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "An error occurred");
      } finally {
        setIsSubmitting(false);
      }
    },
    [router]
  );

  // Option CRUD
  const handleSaveOption = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!optionDialog) return;

      setIsSubmitting(true);
      const formData = new FormData(e.currentTarget);
      const data = {
        menuCode: (formData.get("menuCode") as string) || undefined,
        nameEn: formData.get("nameEn") as string,
        nameMm: (formData.get("nameMm") as string) || undefined,
        price: Number(formData.get("price")) || 0,
        isAvailable: formData.get("isAvailable") === "on",
      };

      try {
        if (optionDialog.mode === "create") {
          const res = await fetch(
            `/api/admin/menu/pools/${optionDialog.poolId}/options`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            }
          );
          if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || "Failed to create option");
          }
          const { option } = await res.json();
          setPools((prev) =>
            prev.map((pool) =>
              pool.id === optionDialog.poolId
                ? { ...pool, options: [...pool.options, option] }
                : pool
            )
          );
          toast.success("Option created");
        } else {
          const res = await fetch(
            `/api/admin/menu/pools/${optionDialog.poolId}/options/${optionDialog.option.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            }
          );
          if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || "Failed to update option");
          }
          const { option } = await res.json();
          setPools((prev) =>
            prev.map((pool) =>
              pool.id === optionDialog.poolId
                ? {
                    ...pool,
                    options: pool.options.map((o) =>
                      o.id === option.id ? option : o
                    ),
                  }
                : pool
            )
          );
          toast.success("Option updated");
        }
        setOptionDialog(null);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "An error occurred");
      } finally {
        setIsSubmitting(false);
      }
    },
    [optionDialog, router]
  );

  const handleDeleteOption = useCallback(
    async (poolId: string, optionId: string) => {
      setIsSubmitting(true);
      try {
        const res = await fetch(
          `/api/admin/menu/pools/${poolId}/options/${optionId}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to delete option");
        }
        setPools((prev) =>
          prev.map((pool) =>
            pool.id === poolId
              ? { ...pool, options: pool.options.filter((o) => o.id !== optionId) }
              : pool
          )
        );
        toast.success("Option deleted");
        setDeleteConfirm(null);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "An error occurred");
      } finally {
        setIsSubmitting(false);
      }
    },
    [router]
  );

  return (
    <>
      <Card className="bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b pb-4">
          <div>
            <CardTitle className="text-xl font-semibold">
              Choice Pools
            </CardTitle>
            <CardDescription>
              Create pools of options that can be attached to set menu items
            </CardDescription>
          </div>
          <Button
            onClick={() => setPoolDialog({ mode: "create" })}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            Add Pool
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {pools.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-slate-500">No choice pools yet</p>
              <p className="mt-1 text-xs text-slate-400">
                Create your first pool to start building set menus
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {pools.map((pool) => {
                const isExpanded = expandedPools.has(pool.id);
                return (
                  <div key={pool.id}>
                    {/* Pool Header */}
                    <div
                      className={cn(
                        "flex items-center gap-3 px-6 py-4 hover:bg-slate-50 cursor-pointer",
                        !pool.isActive && "opacity-60"
                      )}
                      onClick={() => toggleExpanded(pool.id)}
                    >
                      <button
                        className="text-slate-400 hover:text-slate-600"
                        type="button"
                      >
                        {isExpanded ? (
                          <ChevronDownIcon className="h-5 w-5" />
                        ) : (
                          <ChevronRightIcon className="h-5 w-5" />
                        )}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">
                            {pool.nameEn}
                          </span>
                          {pool.nameMm && (
                            <span className="text-sm text-slate-500">
                              ({pool.nameMm})
                            </span>
                          )}
                          {!pool.isActive && (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {pool.options.length} option
                          {pool.options.length !== 1 && "s"}
                        </p>
                      </div>
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPoolDialog({ mode: "edit", pool })}
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() =>
                            setDeleteConfirm({
                              type: "pool",
                              id: pool.id,
                              name: pool.nameEn,
                            })
                          }
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Options List */}
                    {isExpanded && (
                      <div className="border-t bg-slate-50 px-6 py-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="text-sm font-medium text-slate-700">
                            Options
                          </h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setOptionDialog({
                                mode: "create",
                                poolId: pool.id,
                              })
                            }
                          >
                            <PlusIcon className="mr-1 h-3 w-3" />
                            Add Option
                          </Button>
                        </div>
                        {pool.options.length === 0 ? (
                          <p className="text-center text-xs text-slate-400 py-4">
                            No options in this pool yet
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {pool.options.map((option) => (
                              <div
                                key={option.id}
                                className={cn(
                                  "flex items-center gap-3 rounded-lg border bg-white px-4 py-3",
                                  !option.isAvailable && "opacity-60"
                                )}
                              >
                                <GripVerticalIcon className="h-4 w-4 text-slate-300" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    {option.menuCode && (
                                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                                        {option.menuCode}
                                      </span>
                                    )}
                                    <span className="font-medium text-slate-900 truncate">
                                      {option.nameEn}
                                    </span>
                                    {option.nameMm && (
                                      <span className="text-sm text-slate-500 truncate">
                                        ({option.nameMm})
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-medium text-slate-700">
                                    ฿{option.price}
                                  </span>
                                  {!option.isAvailable && (
                                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                                      Unavailable
                                    </span>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setOptionDialog({
                                        mode: "edit",
                                        poolId: pool.id,
                                        option,
                                      })
                                    }
                                  >
                                    <PencilIcon className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                    onClick={() =>
                                      setDeleteConfirm({
                                        type: "option",
                                        id: option.id,
                                        poolId: pool.id,
                                        name: option.nameEn,
                                      })
                                    }
                                  >
                                    <TrashIcon className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pool Dialog */}
      <Dialog open={poolDialog !== null} onOpenChange={() => setPoolDialog(null)}>
        <DialogContent>
          <form onSubmit={handleSavePool}>
            <DialogHeader>
              <DialogTitle>
                {poolDialog?.mode === "create" ? "Create Pool" : "Edit Pool"}
              </DialogTitle>
              <DialogDescription>
                {poolDialog?.mode === "create"
                  ? "Create a new choice pool for set menus"
                  : "Update pool details"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nameEn">Name (English) *</Label>
                <Input
                  id="nameEn"
                  name="nameEn"
                  placeholder="e.g., Base Curry, Add-on Vegetables"
                  defaultValue={
                    poolDialog?.mode === "edit" ? poolDialog.pool.nameEn : ""
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nameMm">Name (Burmese)</Label>
                <Input
                  id="nameMm"
                  name="nameMm"
                  placeholder="Optional Burmese name"
                  defaultValue={
                    poolDialog?.mode === "edit"
                      ? poolDialog.pool.nameMm ?? ""
                      : ""
                  }
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  name="isActive"
                  defaultChecked={
                    poolDialog?.mode === "edit"
                      ? poolDialog.pool.isActive
                      : true
                  }
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPoolDialog(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Option Dialog */}
      <Dialog
        open={optionDialog !== null}
        onOpenChange={() => setOptionDialog(null)}
      >
        <DialogContent>
          <form onSubmit={handleSaveOption}>
            <DialogHeader>
              <DialogTitle>
                {optionDialog?.mode === "create"
                  ? "Add Option"
                  : "Edit Option"}
              </DialogTitle>
              <DialogDescription>
                {optionDialog?.mode === "create"
                  ? "Add a new option to this pool"
                  : "Update option details"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="menuCode">Menu Code</Label>
                <Input
                  id="menuCode"
                  name="menuCode"
                  placeholder="e.g., RS1, AD5, AV3"
                  defaultValue={
                    optionDialog?.mode === "edit"
                      ? optionDialog.option.menuCode ?? ""
                      : ""
                  }
                />
                <p className="text-xs text-slate-500">
                  For kitchen/POS identification
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nameEn">Name (English) *</Label>
                <Input
                  id="nameEn"
                  name="nameEn"
                  placeholder="e.g., Chicken Curry"
                  defaultValue={
                    optionDialog?.mode === "edit"
                      ? optionDialog.option.nameEn
                      : ""
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nameMm">Name (Burmese)</Label>
                <Input
                  id="nameMm"
                  name="nameMm"
                  placeholder="Optional Burmese name"
                  defaultValue={
                    optionDialog?.mode === "edit"
                      ? optionDialog.option.nameMm ?? ""
                      : ""
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price (THB) *</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  defaultValue={
                    optionDialog?.mode === "edit"
                      ? optionDialog.option.price
                      : "0"
                  }
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isAvailable"
                  name="isAvailable"
                  defaultChecked={
                    optionDialog?.mode === "edit"
                      ? optionDialog.option.isAvailable
                      : true
                  }
                />
                <Label htmlFor="isAvailable">Available</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOptionDialog(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteConfirm?.type}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteConfirm?.name}&quot;?
              {deleteConfirm?.type === "pool" &&
                " This will also delete all options in this pool."}
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirm?.type === "pool") {
                  handleDeletePool(deleteConfirm.id);
                } else if (deleteConfirm?.type === "option" && deleteConfirm.poolId) {
                  handleDeleteOption(deleteConfirm.poolId, deleteConfirm.id);
                }
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
