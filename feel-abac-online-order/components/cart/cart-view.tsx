"use client";

import { useState } from "react";
import Link from "next/link";

import { useMenuLocale } from "@/components/i18n/menu-locale-provider";
import type { CartRecord } from "@/lib/cart/types";

type CartDictionary = typeof import("@/dictionaries/en/cart.json");

type CartViewProps = {
  cart: CartRecord | null;
  dictionary: CartDictionary;
  menuHref: string;
};

function formatPrice(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CartView({ cart, dictionary, menuHref }: CartViewProps) {
  const { menuLocale } = useMenuLocale();
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [visibleNotes, setVisibleNotes] = useState<Record<string, boolean>>({});
  const quantityLabel = dictionary.items.quantityLabel;
  const quantityLabelLower = quantityLabel.toLowerCase();

  if (!cart || cart.items.length === 0) {
    return (
      <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
        <h2 className="text-2xl font-semibold text-slate-900">
          {dictionary.empty.heading}
        </h2>
        <p className="mt-2 text-sm text-slate-500">{dictionary.empty.body}</p>
        <Link
          href={menuHref}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          {dictionary.empty.cta}
        </Link>
      </section>
    );
  }

  const itemCount = cart.items.length;
  const totalQuantity = cart.items.reduce(
    (total, item) => total + item.quantity,
    0
  );
  const itemCountLabel =
    itemCount === 1
      ? dictionary.summary.itemsLabel.one
      : dictionary.summary.itemsLabel.other.replace(
          "{{count}}",
          String(itemCount)
        );

  return (
    <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-3.5">
        {cart.items.map((item) => {
          const displayName =
            menuLocale === "my"
              ? item.menuItemNameMm ?? item.menuItemName
              : item.menuItemName;
          const unitPrice = item.basePrice + item.addonsTotal;
          const groupedChoices = groupChoices(item.choices, menuLocale);
          const isExpanded = !!expandedDetails[item.id];
          const noteVisible = !!visibleNotes[item.id];

          return (
            <article
              key={item.id}
              className="space-y-2.5 rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-sm"
            >
              <header className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-slate-900">
                    {displayName}
                  </h3>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">
                    {quantityLabel}: {item.quantity}
                  </p>
                  <p className="text-xs text-slate-500">
                    ฿{formatPrice(unitPrice)} / {quantityLabelLower}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">
                    {dictionary.items.priceLabel}
                  </span>
                  <p className="text-base font-semibold text-emerald-600">
                    ฿{formatPrice(item.totalPrice)}
                  </p>
                </div>
              </header>

              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                {groupedChoices.length > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedDetails((prev) => ({
                        ...prev,
                        [item.id]: !isExpanded,
                      }))
                    }
                    className="rounded-full border border-emerald-200 px-2.5 py-0.5 transition hover:bg-emerald-50"
                  >
                    {isExpanded
                      ? dictionary.items.hideDetails
                      : dictionary.items.showDetails}
                  </button>
                ) : null}

                {item.note ? (
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleNotes((prev) => ({
                        ...prev,
                        [item.id]: !noteVisible,
                      }))
                    }
                    className="rounded-full border border-amber-200 px-2.5 py-0.5 text-amber-800 transition hover:bg-amber-50"
                  >
                    {noteVisible
                      ? dictionary.items.hideNote
                      : dictionary.items.showNote}
                  </button>
                ) : null}
              </div>

              {isExpanded && groupedChoices.length > 0 ? (
                <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {dictionary.items.choicesHeading}
                  </p>
                  <div className="space-y-2">
                    {groupedChoices.map((group) => (
                      <div key={group.id}>
                        <p className="text-sm font-medium text-slate-700">
                          {group.label}
                        </p>
                        <ul className="mt-1 space-y-1 text-[13px] text-slate-600">
                          {group.options.map((option) => (
                            <li
                              key={option.id}
                              className="flex items-center justify-between"
                            >
                              <span>{option.label}</span>
                              {option.extraPrice > 0 ? (
                                <span className="text-xs font-semibold text-emerald-600">
                                  +฿{formatPrice(option.extraPrice)}
                                </span>
                              ) : (
                                <span className="text-[10px] uppercase tracking-wide text-slate-400">
                                  +฿0.00
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {item.note && noteVisible ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800">
                  <p className="text-xs font-semibold uppercase tracking-wide">
                    {dictionary.items.noteLabel}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{item.note}</p>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
        <div className="space-y-2.5">
          <h2 className="text-base font-semibold text-slate-900">
            {dictionary.summary.heading}
          </h2>
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>{itemCountLabel}</span>
            <span>
              {totalQuantity} {dictionary.items.quantityLabel}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
            <span>{dictionary.summary.subtotal}</span>
            <span>฿{formatPrice(cart.subtotal)}</span>
          </div>
        </div>

        <button
          type="button"
          className="flex w-full items-center justify-center rounded-full bg-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-500"
          disabled
        >
          {dictionary.summary.checkoutCta}
        </button>
        <p className="text-center text-[11px] text-slate-400">
          {dictionary.summary.comingSoon}
        </p>

        <Link
          href={menuHref}
          className="flex w-full items-center justify-center rounded-full border border-emerald-200 px-5 py-2.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-50"
        >
          {dictionary.empty.cta}
        </Link>
      </aside>
    </div>
  );
}

function groupChoices(
  choices: CartRecord["items"][number]["choices"],
  menuLocale: string
) {
  const map = new Map<
    string,
    { id: string; label: string; options: Array<{ id: string; label: string; extraPrice: number }> }
  >();

  for (const choice of choices) {
    const groupLabel =
      menuLocale === "my"
        ? choice.groupNameMm ?? choice.groupName
        : choice.groupName;
    const optionLabel =
      menuLocale === "my"
        ? choice.optionNameMm ?? choice.optionName
        : choice.optionName;

    const groupKey = `${choice.cartItemId}:${choice.groupName}`;
    const group =
      map.get(groupKey) ??
      {
        id: groupKey,
        label: groupLabel,
        options: [],
      };

    group.options.push({
      id: `${choice.id}-${choice.optionName}`,
      label: optionLabel,
      extraPrice: choice.extraPrice,
    });

    map.set(groupKey, group);
  }

  return Array.from(map.values());
}
