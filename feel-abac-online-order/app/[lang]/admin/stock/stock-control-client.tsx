"use client";

import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import clsx from "clsx";
import { Package, PackageX, ChevronDown, X, AlertTriangle } from "lucide-react";
import type { StockCategory, StockItem } from "@/lib/menu/stock-queries";

type StockControlClientProps = {
  initialCategories: StockCategory[];
  initialItems: StockItem[];
};

type ConfirmModalState = {
  item: StockItem;
  newStatus: boolean;
} | null;

export function StockControlClient({
  initialCategories,
  initialItems,
}: StockControlClientProps) {
  const [items, setItems] = useState(initialItems);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialCategories[0]?.id ?? ""
  );
  const [updating, setUpdating] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>(null);

  // Filter items by selected category
  const filteredItems = useMemo(() => {
    return items.filter((item) => item.categoryId === selectedCategory);
  }, [items, selectedCategory]);

  // Count stats for current category
  const stats = useMemo(() => {
    const inStock = filteredItems.filter((i) => i.isAvailable).length;
    const outOfStock = filteredItems.length - inStock;
    return { total: filteredItems.length, inStock, outOfStock };
  }, [filteredItems]);

  // Open confirmation modal
  const requestToggle = useCallback((item: StockItem) => {
    setConfirmModal({ item, newStatus: !item.isAvailable });
  }, []);

  // Execute the toggle
  const executeToggle = async () => {
    if (!confirmModal) return;

    const { item, newStatus } = confirmModal;
    setConfirmModal(null);
    setUpdating(item.id);

    try {
      const response = await fetch(
        `/api/admin/menu/items/${item.id}/availability`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isAvailable: newStatus }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast.error(data.error || "Failed to update");
        return;
      }

      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isAvailable: newStatus } : i))
      );

      toast.success(
        `${item.nameEn} marked as ${newStatus ? "in stock" : "out of stock"}`
      );
    } catch {
      toast.error("Network error");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Category Dropdown + Stats */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Dropdown Filter */}
        <div className="relative">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-4 pr-10 text-sm font-medium text-slate-900 shadow-sm transition-colors hover:border-slate-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 sm:w-64"
          >
            {initialCategories.map((cat) => {
              const count = items.filter((i) => i.categoryId === cat.id).length;
              return (
                <option key={cat.id} value={cat.id}>
                  {cat.nameEn} {cat.nameMm ? `(${cat.nameMm})` : ""} — {count}
                </option>
              );
            })}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-emerald-600">
            <Package className="h-4 w-4" />
            <strong>{stats.inStock}</strong> in stock
          </span>
          <span className="flex items-center gap-1.5 text-red-500">
            <PackageX className="h-4 w-4" />
            <strong>{stats.outOfStock}</strong> out
          </span>
        </div>
      </div>

      {/* Items List */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {filteredItems.length === 0 ? (
          <div className="px-4 py-12 text-center text-slate-500">
            No items in this category
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredItems.map((item) => (
              <StockItemRow
                key={item.id}
                item={item}
                isUpdating={updating === item.id}
                onToggle={() => requestToggle(item)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <ConfirmStockModal
          item={confirmModal.item}
          newStatus={confirmModal.newStatus}
          onConfirm={executeToggle}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}

// Stock item row component
function StockItemRow({
  item,
  isUpdating,
  onToggle,
}: {
  item: StockItem;
  isUpdating: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      {/* Menu Code */}
      <div className="w-14 shrink-0">
        {item.menuCode ? (
          <span className="inline-block rounded bg-slate-100 px-2 py-1 text-xs font-mono font-medium text-slate-600">
            {item.menuCode}
          </span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </div>

      {/* Names */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-900">{item.nameEn}</p>
        {item.nameMm && (
          <p className="truncate text-sm text-slate-500">{item.nameMm}</p>
        )}
      </div>

      {/* Toggle Switch */}
      <button
        onClick={onToggle}
        disabled={isUpdating}
        className={clsx(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
          isUpdating && "pointer-events-none opacity-50",
          item.isAvailable
            ? "bg-emerald-500 focus:ring-emerald-500"
            : "bg-red-400 focus:ring-red-400"
        )}
        role="switch"
        aria-checked={item.isAvailable}
      >
        {isUpdating ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </span>
        ) : (
          <span
            className={clsx(
              "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
              item.isAvailable ? "translate-x-6" : "translate-x-1"
            )}
          />
        )}
      </button>

      {/* Status Label */}
      <span
        className={clsx(
          "w-20 text-right text-sm font-medium",
          item.isAvailable ? "text-emerald-600" : "text-red-500"
        )}
      >
        {item.isAvailable ? "In Stock" : "Out"}
      </span>
    </li>
  );
}

// Confirmation modal component
function ConfirmStockModal({
  item,
  newStatus,
  onConfirm,
  onCancel,
}: {
  item: StockItem;
  newStatus: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isMarkingOutOfStock = !newStatus;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Icon */}
        <div
          className={clsx(
            "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full",
            isMarkingOutOfStock ? "bg-red-100" : "bg-emerald-100"
          )}
        >
          {isMarkingOutOfStock ? (
            <AlertTriangle className="h-7 w-7 text-red-600" />
          ) : (
            <Package className="h-7 w-7 text-emerald-600" />
          )}
        </div>

        {/* Title */}
        <h3 className="mb-2 text-center text-lg font-semibold text-slate-900">
          {isMarkingOutOfStock ? "Mark as Out of Stock?" : "Mark as In Stock?"}
        </h3>

        {/* Item details */}
        <div className="mb-6 rounded-lg bg-slate-50 p-4">
          <div className="flex items-start gap-3">
            {item.menuCode && (
              <span className="shrink-0 rounded bg-slate-200 px-2 py-1 text-xs font-mono font-medium text-slate-600">
                {item.menuCode}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{item.nameEn}</p>
              {item.nameMm && (
                <p className="text-sm text-slate-500">{item.nameMm}</p>
              )}
            </div>
          </div>
        </div>

        {/* Warning text */}
        <p className="mb-6 text-center text-sm text-slate-600">
          {isMarkingOutOfStock
            ? "This item will be shown as unavailable to customers and cannot be ordered."
            : "This item will be available for customers to order again."}
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={clsx(
              "flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors",
              isMarkingOutOfStock
                ? "bg-red-500 hover:bg-red-600"
                : "bg-emerald-500 hover:bg-emerald-600"
            )}
          >
            {isMarkingOutOfStock ? "Mark Out of Stock" : "Mark In Stock"}
          </button>
        </div>
      </div>
    </div>
  );
}
