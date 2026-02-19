"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type AddToCartFooterProps = {
  quantity: number;
  canDecrease: boolean;
  canIncrease: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
  onAddToCart: () => void;
  isSubmitting?: boolean;
  isDisabled?: boolean;
  label: string;
  busyLabel: string;
  priceLabel: string;
};

export function AddToCartFooter({
  quantity,
  canDecrease,
  canIncrease,
  onDecrease,
  onIncrease,
  onAddToCart,
  isSubmitting = false,
  isDisabled = false,
  label,
  busyLabel,
  priceLabel,
}: AddToCartFooterProps) {
  const effectiveDisabled = isDisabled || isSubmitting;

  return (
    <div className="fixed inset-x-0 bottom-16 z-20 overflow-x-clip border-t bg-white px-4 py-4 shadow-lg sm:bottom-0 sm:px-6">
      <div className="mx-auto flex max-w-lg min-w-0 items-center gap-4">
        <div className="shrink-0 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={onDecrease}
            disabled={!canDecrease || effectiveDisabled}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-white disabled:opacity-40"
          >
            <MinusIcon className="h-4 w-4" />
          </button>
          <span className="w-8 text-center font-medium text-slate-900">
            {quantity}
          </span>
          <button
            type="button"
            onClick={onIncrease}
            disabled={!canIncrease || effectiveDisabled}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-white disabled:opacity-40"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onAddToCart}
          disabled={effectiveDisabled}
          className={cn(
            "min-w-0 flex flex-1 items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold text-white shadow-xl shadow-emerald-500/35 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
            effectiveDisabled
              ? "bg-emerald-600/80"
              : "bg-emerald-600 hover:bg-emerald-500"
          )}
        >
          {isSubmitting ? (
            <>
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent"
              />
              <span className="truncate">{busyLabel}</span>
            </>
          ) : (
            <>
              <span className="min-w-0 truncate italic">{label}</span>
              <span>- {priceLabel}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
