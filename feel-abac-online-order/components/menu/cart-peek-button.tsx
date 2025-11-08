"use client";

import Link from "next/link";

import type { CartSummary } from "@/lib/cart/types";

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
  if (!summary || summary.totalQuantity === 0) {
    return null;
  }

  const itemsLabel =
    summary.totalQuantity === 1
      ? dictionary.itemsLabel.one
      : dictionary.itemsLabel.other.replace(
          "{{count}}",
          String(summary.totalQuantity)
        );

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-40 w-full max-w-sm -translate-x-1/2 px-3 sm:px-0">
      <Link
        href={cartHref}
        className="pointer-events-auto flex items-center justify-between rounded-full bg-emerald-600 px-5 py-3 text-white shadow-xl shadow-emerald-500/30 transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/60"
      >
        <div>
          <p className="text-sm font-semibold">{dictionary.button}</p>
          <p className="text-xs text-emerald-100">{itemsLabel}</p>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase tracking-wide text-emerald-100">
            {dictionary.totalLabel}
          </span>
          <p className="text-lg font-semibold text-white">
            ฿{formatPrice(summary.subtotal)}
          </p>
        </div>
      </Link>
    </div>
  );
}
