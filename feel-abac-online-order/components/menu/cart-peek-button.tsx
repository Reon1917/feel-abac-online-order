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
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-4 sm:px-0">
      <Link
        href={cartHref}
        className="pointer-events-auto flex items-center justify-between rounded-full bg-slate-900 px-6 py-4 text-white shadow-2xl shadow-emerald-600/20 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/60"
      >
        <div>
          <p className="text-sm font-semibold">{dictionary.button}</p>
          <p className="text-xs text-slate-300">{itemsLabel}</p>
        </div>
        <div className="text-right">
          <span className="text-xs uppercase tracking-wide text-slate-400">
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
