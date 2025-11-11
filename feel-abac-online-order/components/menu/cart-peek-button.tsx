"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import type { CartSummary } from "@/lib/cart/types";
import { useCartDraft } from "./cart-draft-provider";

type MenuDictionary = typeof import("@/dictionaries/en/menu.json");

type CartPeekButtonProps = {
  summary: CartSummary | null;
  dictionary: NonNullable<MenuDictionary["cartPeek"]>;
  cartHref: string;
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
}: CartPeekButtonProps) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const {
    pendingItems,
    pendingQuantity,
    pendingSubtotal,
    applyPendingAdditions,
    isApplying,
  } = useCartDraft();

  const hasPending = pendingQuantity > 0;
  const showSummary = !!summary && summary.totalQuantity > 0;

  if (!hasPending && !showSummary) {
    return null;
  }

  const itemsLabel = summary
    ? summary.totalQuantity === 1
      ? dictionary.itemsLabel.one
      : dictionary.itemsLabel.other.replace(
          "{{count}}",
          String(summary.totalQuantity)
        )
    : dictionary.itemsLabel.other.replace("{{count}}", "0");

  const pendingLabel = hasPending
    ? (pendingQuantity === 1
        ? dictionary.pendingLabel.one
        : dictionary.pendingLabel.other.replace("{{count}}", String(pendingQuantity)))
    : "";

  const handleClick = () => {
    if (isNavigating) {
      return;
    }
    startTransition(() => {
      router.push(cartHref);
    });
  };

  const handleApplyPending = () => {
    if (isApplying || pendingItems.length === 0) {
      return;
    }
    void applyPendingAdditions();
  };

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-40 w-full max-w-sm -translate-x-1/2 px-3 sm:px-0">
      <div className="flex flex-col gap-3">
        {hasPending && (
          <button
            type="button"
            onClick={handleApplyPending}
            className="pointer-events-auto flex w-full items-center justify-between rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-emerald-700 shadow-md shadow-emerald-500/20 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
            aria-busy={isApplying}
            disabled={isApplying}
          >
            <div className="text-left">
              <p className="text-sm font-semibold">
                {isApplying ? dictionary.applyProcessing : dictionary.applyButton}
              </p>
              <p className="text-xs text-emerald-500">{pendingLabel}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wide text-emerald-400">
                {dictionary.totalLabel}
              </span>
              <p className="text-base font-semibold text-emerald-700">
                ฿{formatPrice(pendingSubtotal)}
              </p>
            </div>
          </button>
        )}

        {showSummary && summary && (
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
                  ฿{formatPrice(summary.subtotal)}
                </p>
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
