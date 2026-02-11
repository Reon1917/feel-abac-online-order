"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import type { CartSummary } from "@/lib/cart/types";
import { computeOrderTotals } from "@/lib/orders/totals";

type MenuDictionary = typeof import("@/dictionaries/en/menu.json");

type CartPeekButtonProps = {
  summary: CartSummary | null;
  dictionary: NonNullable<MenuDictionary["cartPeek"]>;
  cartHref: string;
  optimisticQuantity?: number;
  optimisticSubtotal?: number;
};

function formatPrice(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CartPeekButton({
  summary,
  dictionary,
  cartHref,
  optimisticQuantity = 0,
  optimisticSubtotal = 0,
}: CartPeekButtonProps) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const baseQuantity = summary?.totalQuantity ?? 0;
  const baseSubtotal = summary?.subtotal ?? 0;
  const displayQuantity = baseQuantity + optimisticQuantity;
  const displaySubtotal = computeOrderTotals({
    foodSubtotal: baseSubtotal + optimisticSubtotal,
  }).foodTotal;
  const showSummary = displayQuantity > 0;

  if (!showSummary) {
    return null;
  }

  const itemsLabel =
    displayQuantity === 1
      ? dictionary.itemsLabel.one
      : dictionary.itemsLabel.other.replace(
          "{{count}}",
          String(displayQuantity)
        );

  const handleClick = () => {
    if (isNavigating) {
      return;
    }
    startTransition(() => {
      router.push(cartHref);
    });
  };

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-40 w-full max-w-sm -translate-x-1/2 px-3 sm:px-0">
      <button
        type="button"
        onClick={handleClick}
        className="pointer-events-auto flex w-full items-center justify-between rounded-full bg-emerald-600 px-5 py-3 text-white shadow-xl shadow-emerald-500/30 transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/60 disabled:cursor-not-allowed disabled:opacity-70"
        aria-busy={isNavigating}
        disabled={isNavigating}
      >
        <div className="text-left">
          <p className="text-sm font-semibold">
            {isNavigating ? dictionary.processing : dictionary.button}
          </p>
          <p className="text-xs text-emerald-100">{itemsLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          {isNavigating && (
            <span
              className="inline-flex h-5 w-5 animate-spin rounded-full border-2 border-white/50 border-t-transparent"
              aria-hidden="true"
            />
          )}
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wide text-emerald-100">
              {dictionary.totalLabel}
            </span>
            <p className="text-lg font-semibold text-white">
              ฿{formatPrice(displaySubtotal)}
            </p>
          </div>
        </div>
      </button>
    </div>
  );
}
